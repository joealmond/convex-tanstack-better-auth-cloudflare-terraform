import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import { createTestBackend } from './test.utils'

describe('seed and health', () => {
  it('seeds once and leaves existing data intact', async () => {
    const t = createTestBackend()
    expect(await t.mutation(internal.seed.run)).toMatchObject({ seeded: true, count: 5 })
    expect(await t.mutation(internal.seed.run)).toMatchObject({ seeded: false })
    expect(await t.query(api.messages.list)).toHaveLength(5)
  })

  it('serves the Convex health endpoint', async () => {
    const response = await createTestBackend().fetch('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', layer: 'convex' })
  })
})
