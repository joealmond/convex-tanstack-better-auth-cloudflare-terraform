/// <reference types="vite/client" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { convexTest } from 'convex-test'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.*s')

afterEach(() => vi.useRealTimers())

describe('retention maintenance', () => {
  it('deletes messages older than 90 days and expired upload intents', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('messages', { content: 'expired' })
      await ctx.db.insert('uploadIntents', { userId: 'user-1', expiresAt: Date.now() + 1_000 })
    })

    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'))
    await t.mutation(internal.maintenance.deleteExpiredData)

    expect(await t.query(api.messages.list)).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('uploadIntents').collect())).toEqual([])
  })
})
