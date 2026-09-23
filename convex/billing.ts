import { ConvexError, v } from 'convex/values'
import { authQuery, internalMutation, internalQuery } from './lib/customFunctions'

const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete_expired',
  'provider_clear',
])
const TERMINAL_CHECKOUT_STATUSES = new Set(['checkout_expired', 'provider_clear'])
const DELETE_BLOCKED_MESSAGE =
  'Wait for a pending Stripe Checkout to expire or cancel your subscription in the billing portal before deleting this account.'

export function canStillCharge(
  subscription: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    checkoutSessionId?: string
    status: string
  } | null
) {
  if (!subscription) return false
  if (subscription.stripeSubscriptionId)
    return !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)
  const hasProviderReference = Boolean(
    subscription.stripeCustomerId || subscription.checkoutSessionId
  )
  return hasProviderReference && !TERMINAL_CHECKOUT_STATUSES.has(subscription.status)
}

export function isTerminalStripeSubscription(status: string) {
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status)
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
    if (canStillCharge(subscription)) throw new ConvexError(DELETE_BLOCKED_MESSAGE)
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

/** Called only after Stripe confirms no subscriptions or open Checkout sessions. */
export const markProviderClear = internalMutation({
  args: {
    ownerId: v.string(),
    stripeCustomerId: v.string(),
    checkoutSessionId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (
      !current ||
      current.stripeCustomerId !== args.stripeCustomerId ||
      current.checkoutSessionId !== args.checkoutSessionId ||
      current.stripeSubscriptionId !== args.stripeSubscriptionId
    ) {
      throw new ConvexError('Billing changed during deletion; retry the request')
    }
    await ctx.db.patch(current._id, { status: 'provider_clear', updatedAt: Date.now() })
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
    if (canStillCharge(subscription)) throw new ConvexError(DELETE_BLOCKED_MESSAGE)

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
    const deleted = await ctx.db
      .query('billingDeletionTombstones')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (deleted) throw new ConvexError('This account is being deleted')
    const existing = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (existing && canStillCharge(existing))
      throw new ConvexError('A Stripe Checkout or subscription already exists for this account')
    const values = {
      stripeCustomerId: args.stripeCustomerId,
      checkoutSessionId: args.checkoutSessionId,
      priceId: args.priceId,
      status: 'checkout_pending',
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...values,
        // A canceled subscription belongs to the previous Checkout generation.
        stripeSubscriptionId: undefined,
        currentPeriodEnd: undefined,
      })
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

    const checkoutEvent = args.eventType.startsWith('checkout.session.')
    const staleCheckout =
      checkoutEvent &&
      existing?.checkoutSessionId &&
      args.checkoutSessionId !== existing.checkoutSessionId
    const unboundSubscription =
      !checkoutEvent && existing?.status === 'checkout_pending' && !existing.stripeSubscriptionId
    const staleSubscription =
      !checkoutEvent &&
      existing?.stripeSubscriptionId &&
      args.stripeSubscriptionId !== existing.stripeSubscriptionId
    const wrongCustomer = existing && existing.stripeCustomerId !== args.stripeCustomerId
    if (
      existing?.status === 'provider_clear' ||
      staleCheckout ||
      unboundSubscription ||
      staleSubscription ||
      wrongCustomer
    ) {
      await ctx.db.insert('stripeEvents', {
        eventId: args.eventId,
        eventType: args.eventType,
        processedAt: Date.now(),
      })
      return
    }

    const checkoutCannotReplaceSubscription = Boolean(
      checkoutEvent && existing?.stripeSubscriptionId
    )
    const values = {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: checkoutCannotReplaceSubscription
        ? existing?.stripeSubscriptionId
        : args.stripeSubscriptionId,
      checkoutSessionId: checkoutCannotReplaceSubscription
        ? existing?.checkoutSessionId
        : (args.checkoutSessionId ?? existing?.checkoutSessionId),
      priceId: args.priceId ?? existing?.priceId,
      status: checkoutCannotReplaceSubscription ? (existing?.status ?? args.status) : args.status,
      currentPeriodEnd: checkoutCannotReplaceSubscription
        ? existing?.currentPeriodEnd
        : args.currentPeriodEnd,
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
