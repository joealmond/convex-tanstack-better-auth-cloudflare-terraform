import { ConvexError, v } from 'convex/values'
import { Effect } from 'effect'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { authMutation, authQuery, internalMutation } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'
import { runEffect } from './lib/runEffect'

const MAX_PROMPT_LENGTH = 1_000
const MAX_OUTPUT_LENGTH = 16_000
const MAX_SSE_BUFFER_LENGTH = 64_000
const PROVIDER_TIMEOUT_MS = 60_000
const DEFAULT_MODEL = 'gpt-5.4-mini'

function streamError(event: Record<string, unknown>): Error {
  const error = event.error
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : typeof event.message === 'string'
        ? event.message
        : 'OpenAI generation did not complete'
  return new Error(message.slice(0, 500))
}

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
    if (!run || run.ownerId !== ownerId || run.status === 'completed' || run.status === 'error')
      return
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
      await runEffect(
        Effect.tryPromise({
          try: async (signal) => {
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
                    content:
                      'Answer clearly and concisely. Use Markdown when it improves readability.',
                  },
                  { role: 'user', content: prompt },
                ],
                max_output_tokens: 1_000,
                stream: true,
              }),
              signal,
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
            let completed = false

            const flush = async () => {
              if (!pendingChunk) return
              const chunk = pendingChunk
              pendingChunk = ''
              await ctx.runMutation(internal.ai.appendOutput, { runId, ownerId, chunk, model })
            }

            try {
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
                    const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line
                    if (!normalizedLine.startsWith('data:')) continue
                    const data = normalizedLine.slice(5).trim()
                    if (!data || data === '[DONE]') continue
                    const parsed: unknown = JSON.parse(data)
                    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
                      throw new Error('OpenAI stream event was invalid')
                    }
                    const streamEvent = parsed as Record<string, unknown>
                    if (streamEvent.type === 'response.completed') {
                      completed = true
                      continue
                    }
                    if (
                      streamEvent.type === 'response.failed' ||
                      streamEvent.type === 'response.incomplete' ||
                      streamEvent.type === 'error'
                    ) {
                      throw streamError(streamEvent)
                    }
                    if (streamEvent.type === 'response.output_text.delta') {
                      if (typeof streamEvent.delta !== 'string') {
                        throw new Error('OpenAI output event was invalid')
                      }
                      const remaining = MAX_OUTPUT_LENGTH - outputLength
                      if (remaining <= 0) {
                        throw new Error('OpenAI output exceeded the safe limit')
                      }
                      const delta = streamEvent.delta.slice(0, remaining)
                      pendingChunk += delta
                      outputLength += delta.length
                      if (pendingChunk.length >= 80) await flush()
                      if (outputLength >= MAX_OUTPUT_LENGTH) {
                        await flush()
                        throw new Error('OpenAI output exceeded the safe limit')
                      }
                    }
                  }
                }
                if (done) break
              }

              if (!completed) throw new Error('OpenAI stream ended before completion')
              await flush()
            } finally {
              await reader.cancel().catch(() => {})
              reader.releaseLock()
            }
          },
          catch: (error) => error,
        }).pipe(Effect.timeout(PROVIDER_TIMEOUT_MS))
      )
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
