import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

describe('billing regressions', () => {
  afterEach(() => vi.useRealTimers())
  it('reuses one durable Checkout reservation', async () => {
    const { t, userId } = await createAuthenticatedTest()
    const [first, second] = await Promise.all([
      t.mutation(internal.billing.reserveCheckout, {
        ownerId: userId,
        priceId: 'price_test',
        email: 'user@example.com',
        name: 'User',
        siteUrl: 'https://app.example.com',
      }),
      t.mutation(internal.billing.reserveCheckout, {
        ownerId: userId,
        priceId: 'price_test',
        email: 'user@example.com',
        name: 'User',
        siteUrl: 'https://app.example.com',
      }),
    ])
    expect(first.checkoutOperationId).toBe(second.checkoutOperationId)
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      status: 'checkout_creating',
      checkoutOperationId: first.checkoutOperationId,
    })
  })

  it('does not let an equal-time nonterminal event resurrect a canceled subscription', async () => {
    const { t, userId } = await createAuthenticatedTest()
    const event = {
      ownerId: userId,
      stripeCustomerId: 'cus_ordered',
      stripeSubscriptionId: 'sub_ordered',
      eventCreatedAt: 1_000,
    }
    await t.mutation(internal.billing.applyStripeEvent, {
      ...event,
      eventId: 'evt_cancel',
      eventType: 'customer.subscription.deleted',
      status: 'canceled',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      ...event,
      eventId: 'evt_old_active',
      eventType: 'customer.subscription.updated',
      status: 'active',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      status: 'canceled',
    })
  })

  it('keeps old provider generations from replacing a Checkout being created', async () => {
    const { t, userId } = await createAuthenticatedTest()
    const reservation = await t.mutation(internal.billing.reserveCheckout, {
      ownerId: userId,
      priceId: 'price_new',
      email: 'user@example.com',
      name: 'User',
      siteUrl: 'https://app.example.com',
    })
    await t.mutation(internal.billing.recordCheckoutCustomer, {
      ownerId: userId,
      checkoutOperationId: reservation.checkoutOperationId,
      stripeCustomerId: 'cus_same',
    })
    for (const event of [
      {
        eventId: 'evt_old_sub',
        eventType: 'customer.subscription.updated',
        stripeSubscriptionId: 'sub_old',
        status: 'active',
      },
      {
        eventId: 'evt_old_checkout',
        eventType: 'checkout.session.expired',
        checkoutSessionId: 'cs_old',
        status: 'checkout_expired',
      },
    ])
      await t.mutation(internal.billing.applyStripeEvent, {
        ...event,
        ownerId: userId,
        stripeCustomerId: 'cus_same',
        eventCreatedAt: Date.now(),
      })
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      status: 'checkout_creating',
      checkoutOperationId: reservation.checkoutOperationId,
    })
  })

  it('does not leave a deletion tombstone when preparation is abandoned', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    await asUser.action(api.users.prepareAccountDeletion)
    expect(await t.query(internal.billing.getDeletionTombstone, { ownerId: userId })).toBeNull()
  })

  it('blocks Checkout only during the recoverable deletion lease', async () => {
    vi.useFakeTimers()
    const { t, userId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.beginAccountDeletion, { ownerId: userId })
    await expect(
      t.mutation(internal.billing.reserveCheckout, {
        ownerId: userId,
        priceId: 'price_test',
        email: 'user@example.com',
        name: 'User',
        siteUrl: 'https://app.example.com',
      })
    ).rejects.toThrow('being confirmed')
    await t.mutation(internal.billing.abandonAccountDeletion, { ownerId: userId })
    await expect(
      t.mutation(internal.billing.reserveCheckout, {
        ownerId: userId,
        priceId: 'price_test',
        email: 'user@example.com',
        name: 'User',
        siteUrl: 'https://app.example.com',
      })
    ).resolves.toMatchObject({ checkoutOperationId: expect.any(String) })
  })

  it('prunes webhook deduplication records without expiring tombstones', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { t } = await createAuthenticatedTest()
    await t.run(async (ctx) => {
      await ctx.db.insert('stripeEvents', {
        eventId: 'evt_old',
        eventType: 'customer.subscription.updated',
        processedAt: Date.now(),
      })
      await ctx.db.insert('billingDeletionTombstones', {
        ownerId: 'deleted',
        deletedAt: Date.now(),
      })
    })
    vi.setSystemTime(new Date('2026-02-06T00:00:00Z'))
    await t.mutation(internal.billing.deleteExpiredStripeEvents)
    await t.run(async (ctx) => {
      expect(await ctx.db.query('stripeEvents').collect()).toEqual([])
      expect(await ctx.db.query('billingDeletionTombstones').collect()).toHaveLength(1)
    })
  })
})
