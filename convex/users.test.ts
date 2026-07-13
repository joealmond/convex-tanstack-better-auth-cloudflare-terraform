import { describe, expect, it, vi, afterEach } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest, createTestBackend } from './test.utils'
import { isAdmin } from './lib/authHelpers'

afterEach(() => vi.useRealTimers())

describe('users', () => {
  it('returns the current user and evaluates roles', async () => {
    const { asUser } = await createAuthenticatedTest({ name: 'Ada', email: 'ada@example.com' })
    expect(await asUser.query(api.users.current)).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
    })
    expect(await asUser.query(api.users.isAdmin)).toBe(false)
    expect(isAdmin({ _id: 'admin', name: 'Admin', email: 'a@example.com', role: 'admin' })).toBe(
      true
    )
  })

  it('returns null for an anonymous current-user query', async () => {
    expect(await createTestBackend().query(api.users.current)).toBeNull()
  })

  it('schedules application-data deletion', async () => {
    vi.useFakeTimers()
    const { t, asUser, userId } = await createAuthenticatedTest()
    await t.run((ctx) => ctx.db.insert('messages', { content: 'owned', authorId: userId }))
    await asUser.mutation(api.users.requestAccountDataDeletion)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.query(api.messages.list)).toEqual([])
  })
})
