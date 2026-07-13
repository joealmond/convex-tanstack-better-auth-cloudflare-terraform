import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { authMutation, authQuery, internalMutation } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'

const MAX_PROMPT_LENGTH = 1_000
const MAX_OUTPUT_LENGTH = 16_000
const MAX_SSE_BUFFER_LENGTH = 64_000
const PROVIDER_TIMEOUT_MS = 60_000
const DEFAULT_MODEL = 'gpt-5.4-mini'

export const listRecent = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('aiRuns')
      .withIndex('by_owner', (query) => query.eq('ownerId', ctx.userId))
      .order('desc')
      .take(10)
  },
})

export const start = authMutation({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) throw new ConvexError('Prompt is required')
    if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
      throw new ConvexError(`Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer`)
    }

    await rateLimiter.limit(ctx, 'generateAiResponse', { key: ctx.userId, throws: true })
    const runId = await ctx.db.insert('aiRuns', {
      ownerId: ctx.userId,
      prompt: normalizedPrompt,
      output: '',
      status: 'queued',
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.ai.generate, {
      runId,
      ownerId: ctx.userId,
      prompt: normalizedPrompt,
    })
    return runId
  },
})

export const appendOutput = internalMutation({
  args: {
    runId: v.id('aiRuns'),
    ownerId: v.string(),
    chunk: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { runId, ownerId, chunk, model }) => {
    const run = await ctx.db.get(runId)
    if (!run || run.ownerId !== ownerId || run.status === 'completed') return
    await ctx.db.patch(runId, {
      output: `${run.output}${chunk}`.slice(0, MAX_OUTPUT_LENGTH),
      status: 'streaming',
      model,
      updatedAt: Date.now(),
    })
  },
})

export const finish = internalMutation({
  args: { runId: v.id('aiRuns'), ownerId: v.string(), model: v.string() },
  handler: async (ctx, { runId, ownerId, model }) => {
    const run = await ctx.db.get(runId)
    if (!run || run.ownerId !== ownerId) return
    await ctx.db.patch(runId, {
      status: 'completed',
      model,
      updatedAt: Date.now(),
    })
  },
})

export const fail = internalMutation({
  args: { runId: v.id('aiRuns'), ownerId: v.string(), error: v.string() },
  handler: async (ctx, { runId, ownerId, error }) => {
    const run = await ctx.db.get(runId)
    if (!run || run.ownerId !== ownerId) return
    await ctx.db.patch(runId, {
      status: 'error',
      error: error.slice(0, 500),
      updatedAt: Date.now(),
    })
  },
})

export const generate = internalAction({
  args: { runId: v.id('aiRuns'), ownerId: v.string(), prompt: v.string() },
  handler: async (ctx, { runId, ownerId, prompt }) => {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
    if (!apiKey) {
      await ctx.runMutation(internal.ai.fail, {
        runId,
        ownerId,
        error: 'OPENAI_API_KEY is not configured on this Convex deployment.',
      })
      return
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'developer',
              content: 'Answer clearly and concisely. Use Markdown when it improves readability.',
            },
            { role: 'user', content: prompt },
          ],
          max_output_tokens: 1_000,
          stream: true,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })

      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw new Error(`OpenAI request failed with status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let pendingChunk = ''
      let outputLength = 0

      const flush = async () => {
        if (!pendingChunk) return
        const chunk = pendingChunk
        pendingChunk = ''
        await ctx.runMutation(internal.ai.appendOutput, { runId, ownerId, chunk, model })
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        if (buffer.length > MAX_SSE_BUFFER_LENGTH) {
          throw new Error('OpenAI stream event exceeded the safe buffer limit')
        }
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data || data === '[DONE]') continue
            const parsed: unknown = JSON.parse(data)
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'type' in parsed &&
              parsed.type === 'response.output_text.delta' &&
              'delta' in parsed &&
              typeof parsed.delta === 'string'
            ) {
              const remaining = MAX_OUTPUT_LENGTH - outputLength
              if (remaining <= 0) {
                await reader.cancel()
                break
              }
              const delta = parsed.delta.slice(0, remaining)
              pendingChunk += delta
              outputLength += delta.length
              if (pendingChunk.length >= 80) await flush()
            }
          }
        }
        if (done) break
      }

      await flush()
      await ctx.runMutation(internal.ai.finish, { runId, ownerId, model })
    } catch (error) {
      await ctx.runMutation(internal.ai.fail, {
        runId,
        ownerId,
        error: error instanceof Error ? error.message : 'AI generation failed',
      })
    }
  },
})
