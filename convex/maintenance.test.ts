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

  it('deletes every application record owned by a deleted account', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('todos', {
        ownerId: 'user-1',
        title: 'todo',
        completed: false,
        updatedAt: 0,
      })
      await ctx.db.insert('aiRuns', {
        ownerId: 'user-1',
        prompt: 'prompt',
        output: '',
        status: 'completed',
        updatedAt: 0,
      })
      await ctx.db.insert('emailDeliveries', {
        ownerId: 'user-1',
        to: 'person@example.com',
        kind: 'welcome',
        status: 'sent',
        updatedAt: 0,
      })
      await ctx.db.insert('billingSubscriptions', {
        ownerId: 'user-1',
        status: 'active',
        updatedAt: 0,
      })
      await ctx.db.insert('uploadIntents', { userId: 'user-1', expiresAt: Date.now() + 1_000 })
      await ctx.db.insert('fileUsage', {
        userId: 'user-1',
        totalBytes: 1,
        fileCount: 1,
        updatedAt: 0,
      })
      await ctx.db.insert('messages', { content: 'message', authorId: 'user-1' })
      await ctx.db.insert('todos', {
        ownerId: 'user-2',
        title: 'keep',
        completed: false,
        updatedAt: 0,
      })
    })

    await t.mutation(internal.maintenance.deleteUserDataBatch, { userId: 'user-1' })

    await t.run(async (ctx) => {
      expect(await ctx.db.query('todos').collect()).toHaveLength(1)
      expect(await ctx.db.query('aiRuns').collect()).toEqual([])
      expect(await ctx.db.query('emailDeliveries').collect()).toEqual([])
      expect(await ctx.db.query('billingSubscriptions').collect()).toEqual([])
      expect(await ctx.db.query('uploadIntents').collect()).toEqual([])
      expect(await ctx.db.query('fileUsage').collect()).toEqual([])
      expect(await ctx.db.query('messages').collect()).toEqual([])
    })
  })

  it('keeps a Stripe reference until the subscription is inactive', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('billingSubscriptions', {
        ownerId: 'user-1',
        stripeCustomerId: 'cus_active',
        stripeSubscriptionId: 'sub_active',
        status: 'active',
        updatedAt: 0,
      })
    })

    await t.mutation(internal.maintenance.deleteUserDataBatch, { userId: 'user-1' })

    await t.run(async (ctx) => {
      expect(await ctx.db.query('billingSubscriptions').collect()).toHaveLength(1)
      expect(await ctx.db.query('billingDeletionTombstones').collect()).toEqual([])
    })
  })
})
