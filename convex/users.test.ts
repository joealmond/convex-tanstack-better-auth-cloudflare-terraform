import { describe, expect, it, vi, afterEach } from 'vitest'
import { api } from './_generated/api'
// <convexkit:billing>
import { internal } from './_generated/api'
// </convexkit:billing>
import { createAuthenticatedTest, createTestBackend } from './test.utils'
import { isAdmin } from './lib/authHelpers'
import { ADMIN_EMAILS } from './lib/config'

afterEach(() => vi.useRealTimers())

describe('users', () => {
  it('requires a verified email before granting allowlisted admin access', async () => {
    const email = 'allowlisted@example.com'
    ADMIN_EMAILS.push(email)
    try {
      const unverified = await createAuthenticatedTest({ email, emailVerified: false })
      expect(await unverified.asUser.query(api.users.isAdmin)).toBe(false)
      const messageId = await unverified.t.run((ctx) =>
        ctx.db.insert('messages', { content: 'Protected message', authorId: 'someone-else' })
      )
      await expect(
        unverified.asUser.mutation(api.messages.deleteAny, { id: messageId })
      ).rejects.toThrow('Admin access required')
      expect(await unverified.t.run((ctx) => ctx.db.get(messageId))).not.toBeNull()
      const verified = await createAuthenticatedTest({ email, emailVerified: true })
      expect(await verified.asUser.query(api.users.isAdmin)).toBe(true)
      expect(isAdmin({ _id: 'missing', name: 'User', email })).toBe(false)
    } finally {
      ADMIN_EMAILS.splice(ADMIN_EMAILS.indexOf(email), 1)
    }
  })
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

  // <convexkit:billing>
  it('blocks Clerk-style account deletion while a subscription can charge', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId: userId,
      stripeCustomerId: 'cus_user_guard',
      checkoutSessionId: 'cs_user_guard',
      priceId: 'price_test',
    })
    await expect(asUser.mutation(api.users.prepareAccountDeletion)).rejects.toThrow(
      'billing portal'
    )
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_user_guard_expired',
      eventType: 'checkout.session.expired',
      ownerId: userId,
      stripeCustomerId: 'cus_user_guard',
      checkoutSessionId: 'cs_user_guard',
      status: 'checkout_expired',
    })
    await asUser.mutation(api.users.prepareAccountDeletion)
    expect(await t.query(internal.billing.getDeletionTombstone, { ownerId: userId })).not.toBeNull()
  })
  // </convexkit:billing>
})
