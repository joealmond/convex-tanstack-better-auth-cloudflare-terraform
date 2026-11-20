import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function streamResponse(events: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`))
        controller.close()
      },
    })
  )
}

describe('AI stream terminal states', () => {
  it('completes only after response.completed', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            JSON.stringify({ type: 'response.output_text.delta', delta: 'Hello' }),
            JSON.stringify({ type: 'response.completed' }),
            '[DONE]',
          ])
        )
    )
    const { t, asUser } = await createAuthenticatedTest()
    await asUser.mutation(api.ai.start, { prompt: 'hello' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([
      { output: 'Hello', status: 'completed' },
    ])
  })

  it('fails an early EOF and a provider incomplete event', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        streamResponse([JSON.stringify({ type: 'response.output_text.delta', delta: 'partial' })])
      )
      .mockResolvedValueOnce(
        streamResponse([
          JSON.stringify({
            type: 'response.incomplete',
            error: { message: 'provider stopped early' },
          }),
        ])
      )
    vi.stubGlobal('fetch', request)
    const { t, asUser } = await createAuthenticatedTest()
    await asUser.mutation(api.ai.start, { prompt: 'first' })
    await asUser.mutation(api.ai.start, { prompt: 'second' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const runs = await asUser.query(api.ai.listRecent)
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'error', error: 'provider stopped early' }),
        expect.objectContaining({
          status: 'error',
          error: 'OpenAI stream ended before completion',
          output: '',
        }),
      ])
    )
  })

  it('records an explicit error after reaching the output limit', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            JSON.stringify({ type: 'response.output_text.delta', delta: 'x'.repeat(17_000) }),
          ])
        )
    )
    const { t, asUser } = await createAuthenticatedTest()
    await asUser.mutation(api.ai.start, { prompt: 'long' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([
      { status: 'error', error: 'OpenAI output exceeded the safe limit' },
    ])
  })
})
