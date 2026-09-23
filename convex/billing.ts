import { ConvexError, v } from 'convex/values'
import { authQuery, internalMutation, internalQuery } from './lib/customFunctions'

const TERMINAL_BILLING_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete_expired',
  'checkout_expired',
])

function canStillCharge(
  subscription: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    checkoutSessionId?: string
    status: string
  } | null
) {
  if (!subscription) return false
  const hasProviderReference = Boolean(
    subscription.stripeCustomerId ||
    subscription.stripeSubscriptionId ||
    subscription.checkoutSessionId
  )
  return hasProviderReference && !TERMINAL_BILLING_STATUSES.has(subscription.status)
}

export const current = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', ctx.userId))
      .unique()
  },
})

export const getByOwner = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
  },
})

/**
 * Call this from Better Auth's `beforeDelete` hook. It aborts deletion before
 * the identity is removed when Stripe could still collect a payment.
 */
export const assertAccountDeletionAllowed = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const subscription = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (canStillCharge(subscription))
      throw new ConvexError(
        'Cancel your Stripe subscription in the billing portal before deleting this account.'
      )
  },
})

export const getDeletionTombstone = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query('billingDeletionTombstones')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
  },
})

/**
 * Call this after the deletion guard succeeds and before the identity is
 * removed. The tombstone lets the webhook handler reject delayed events.
 */
export const prepareAccountDeletion = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const subscription = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (canStillCharge(subscription))
      throw new ConvexError(
        'Cancel your Stripe subscription in the billing portal before deleting this account.'
      )

    const tombstone = await ctx.db
      .query('billingDeletionTombstones')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    const values = {
      stripeCustomerId: subscription?.stripeCustomerId,
      stripeSubscriptionId: subscription?.stripeSubscriptionId,
      deletedAt: Date.now(),
    }
    if (tombstone) {
      await ctx.db.patch(tombstone._id, {
        stripeCustomerId: values.stripeCustomerId ?? tombstone.stripeCustomerId,
        stripeSubscriptionId: values.stripeSubscriptionId ?? tombstone.stripeSubscriptionId,
      })
      return tombstone._id
    }
    return await ctx.db.insert('billingDeletionTombstones', { ownerId, ...values })
  },
})

export const saveCheckout = internalMutation({
  args: {
    ownerId: v.string(),
    stripeCustomerId: v.string(),
    checkoutSessionId: v.string(),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    const values = {
      stripeCustomerId: args.stripeCustomerId,
      checkoutSessionId: args.checkoutSessionId,
      priceId: args.priceId,
      status: 'checkout_pending',
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, values)
      return existing._id
    }
    return await ctx.db.insert('billingSubscriptions', { ownerId: args.ownerId, ...values })
  },
})

export const applyStripeEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    ownerId: v.optional(v.string()),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const alreadyProcessed = await ctx.db
      .query('stripeEvents')
      .withIndex('by_event', (query) => query.eq('eventId', args.eventId))
      .unique()
    if (alreadyProcessed) return

    const tombstoneByOwner = args.ownerId
      ? await ctx.db
          .query('billingDeletionTombstones')
          .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId!))
          .unique()
      : null
    const tombstone =
      tombstoneByOwner ??
      (await ctx.db
        .query('billingDeletionTombstones')
        .withIndex('by_customer', (query) => query.eq('stripeCustomerId', args.stripeCustomerId))
        .unique())
    if (tombstone) {
      await ctx.db.insert('stripeEvents', {
        eventId: args.eventId,
        eventType: args.eventType,
        processedAt: Date.now(),
      })
      return
    }

    const byOwner = args.ownerId
      ? await ctx.db
          .query('billingSubscriptions')
          .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId!))
          .unique()
      : null
    const existing =
      byOwner ??
      (await ctx.db
        .query('billingSubscriptions')
        .withIndex('by_customer', (query) => query.eq('stripeCustomerId', args.stripeCustomerId))
        .unique())

    const values = {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      checkoutSessionId: args.checkoutSessionId ?? existing?.checkoutSessionId,
      priceId: args.priceId ?? existing?.priceId,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, values)
    } else if (args.ownerId) {
      await ctx.db.insert('billingSubscriptions', { ownerId: args.ownerId, ...values })
    }

    await ctx.db.insert('stripeEvents', {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: Date.now(),
    })
  },
})
