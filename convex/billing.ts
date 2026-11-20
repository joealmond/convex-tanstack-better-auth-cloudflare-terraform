import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
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
const STRIPE_EVENT_RETENTION_MS = 35 * 24 * 60 * 60 * 1000
const DELETION_RESERVATION_MS = 10 * 60 * 1000

export function canStillCharge(
  subscription: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    checkoutSessionId?: string
    status: string
  } | null
) {
  if (!subscription) return false
  if (subscription.status === 'checkout_creating') return true
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

/** Stripe retries webhooks for days; tombstones are deliberately never pruned. */
export const deleteExpiredStripeEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('stripeEvents')
      .withIndex('by_processed_at', (query) =>
        query.lt('processedAt', Date.now() - STRIPE_EVENT_RETENTION_MS)
      )
      .take(100)
    for (const event of expired) await ctx.db.delete(event._id)
    if (expired.length === 100)
      await ctx.scheduler.runAfter(0, internal.billing.deleteExpiredStripeEvents)
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

export const beginAccountDeletion = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const existing = await ctx.db
      .query('billingDeletionReservations')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (existing && existing.expiresAt > Date.now())
      throw new ConvexError('An account deletion attempt is already being confirmed')
    const expiresAt = Date.now() + DELETION_RESERVATION_MS
    if (existing) await ctx.db.patch(existing._id, { expiresAt })
    else await ctx.db.insert('billingDeletionReservations', { ownerId, expiresAt })
  },
})

export const abandonAccountDeletion = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const reservation = await ctx.db
      .query('billingDeletionReservations')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (reservation) await ctx.db.delete(reservation._id)
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
 * Call this only after the identity provider confirms deletion. The tombstone
 * rejects delayed webhooks without trapping an unconfirmed deletion attempt.
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
      const reservation = await ctx.db
        .query('billingDeletionReservations')
        .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
        .unique()
      if (reservation) await ctx.db.delete(reservation._id)
      return tombstone._id
    }
    const id = await ctx.db.insert('billingDeletionTombstones', { ownerId, ...values })
    const reservation = await ctx.db
      .query('billingDeletionReservations')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (reservation) await ctx.db.delete(reservation._id)
    return id
  },
})

/** Reserve one Checkout operation before contacting Stripe. */
export const reserveCheckout = internalMutation({
  args: {
    ownerId: v.string(),
    priceId: v.string(),
    email: v.string(),
    name: v.string(),
    siteUrl: v.string(),
  },
  handler: async (ctx, { ownerId, priceId, email, name, siteUrl }) => {
    const deleted = await ctx.db
      .query('billingDeletionTombstones')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (deleted) throw new ConvexError('This account is being deleted')
    const deleting = await ctx.db
      .query('billingDeletionReservations')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (deleting && deleting.expiresAt > Date.now())
      throw new ConvexError('This account deletion is being confirmed')
    if (deleting) await ctx.db.delete(deleting._id)
    const existing = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', ownerId))
      .unique()
    if (existing?.status === 'checkout_creating' && existing.checkoutOperationId)
      return {
        checkoutOperationId: existing.checkoutOperationId,
        priceId: existing.priceId,
        stripeCustomerId: existing.stripeCustomerId,
        checkoutReservedAt: existing.checkoutReservedAt,
        checkoutEmail: existing.checkoutEmail,
        checkoutName: existing.checkoutName,
        checkoutSiteUrl: existing.checkoutSiteUrl,
      }
    if (existing && canStillCharge(existing))
      throw new ConvexError(
        'An existing Stripe subscription or Checkout already exists for this account'
      )

    const checkoutOperationId = crypto.randomUUID()
    const values = {
      priceId,
      checkoutOperationId,
      checkoutReservedAt: Date.now(),
      checkoutEmail: email,
      checkoutName: name,
      checkoutSiteUrl: siteUrl,
      stripeSubscriptionId: undefined,
      checkoutSessionId: undefined,
      currentPeriodEnd: undefined,
      status: 'checkout_creating',
      updatedAt: Date.now(),
    }
    if (existing) await ctx.db.patch(existing._id, values)
    else await ctx.db.insert('billingSubscriptions', { ownerId, ...values })
    return {
      checkoutOperationId,
      priceId: values.priceId,
      stripeCustomerId: existing?.stripeCustomerId,
      checkoutReservedAt: values.checkoutReservedAt,
      checkoutEmail: values.checkoutEmail,
      checkoutName: values.checkoutName,
      checkoutSiteUrl: values.checkoutSiteUrl,
    }
  },
})

export const recordCheckoutCustomer = internalMutation({
  args: { ownerId: v.string(), checkoutOperationId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const billing = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (
      !billing ||
      billing.status !== 'checkout_creating' ||
      billing.checkoutOperationId !== args.checkoutOperationId
    )
      throw new ConvexError('Checkout reservation changed; reconcile before retrying')
    if (billing.stripeCustomerId && billing.stripeCustomerId !== args.stripeCustomerId)
      throw new ConvexError('Checkout customer changed; reconcile before retrying')
    if (!billing.stripeCustomerId)
      await ctx.db.patch(billing._id, {
        stripeCustomerId: args.stripeCustomerId,
        updatedAt: Date.now(),
      })
  },
})

export const saveCheckout = internalMutation({
  args: {
    ownerId: v.string(),
    stripeCustomerId: v.string(),
    checkoutSessionId: v.string(),
    priceId: v.string(),
    checkoutOperationId: v.optional(v.string()),
    status: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
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
    if (existing?.checkoutSessionId === args.checkoutSessionId) {
      if (existing.stripeCustomerId !== args.stripeCustomerId)
        throw new ConvexError('Checkout session belongs to a different customer')
      return existing._id
    }
    const resumesReservation =
      existing?.status === 'checkout_creating' &&
      args.checkoutOperationId !== undefined &&
      existing.checkoutOperationId === args.checkoutOperationId
    if (
      resumesReservation &&
      existing?.stripeCustomerId !== undefined &&
      existing.stripeCustomerId !== args.stripeCustomerId
    )
      throw new ConvexError('Checkout customer changed; reconcile before retrying')
    if (existing && canStillCharge(existing) && !resumesReservation)
      throw new ConvexError('A Stripe Checkout or subscription already exists for this account')
    const values = {
      stripeCustomerId: args.stripeCustomerId,
      checkoutSessionId: args.checkoutSessionId,
      priceId: args.priceId,
      checkoutOperationId: undefined,
      checkoutReservedAt: undefined,
      status: args.status ?? 'checkout_pending',
      // Event timestamps apply to the previous Checkout generation. A late
      // event for it must not make this new session look stale.
      lastEventCreatedAt: undefined,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...values,
        // A canceled subscription belongs to the previous Checkout generation.
        stripeSubscriptionId: args.stripeSubscriptionId,
        currentPeriodEnd: undefined,
      })
      return existing._id
    }
    return await ctx.db.insert('billingSubscriptions', { ownerId: args.ownerId, ...values })
  },
})

/** Commit a read-only provider reconciliation only if the billing snapshot is unchanged. */
export const commitCheckoutReconciliation = internalMutation({
  args: {
    ownerId: v.string(),
    expectedUpdatedAt: v.number(),
    expectedStatus: v.string(),
    expectedOperationId: v.optional(v.string()),
    expectedSessionId: v.optional(v.string()),
    stripeCustomerId: v.string(),
    checkoutSessionId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (
      !current ||
      current.updatedAt !== args.expectedUpdatedAt ||
      current.status !== args.expectedStatus ||
      current.checkoutOperationId !== args.expectedOperationId ||
      current.checkoutSessionId !== args.expectedSessionId ||
      (current.stripeCustomerId && current.stripeCustomerId !== args.stripeCustomerId)
    )
      throw new ConvexError('Billing changed during reconciliation; retry the request')
    const deleted = await ctx.db
      .query('billingDeletionTombstones')
      .withIndex('by_owner', (query) => query.eq('ownerId', args.ownerId))
      .unique()
    if (deleted) throw new ConvexError('This account has been deleted')
    await ctx.db.patch(current._id, {
      stripeCustomerId: args.stripeCustomerId,
      checkoutSessionId: args.checkoutSessionId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodEnd: args.currentPeriodEnd,
      status: args.status,
      checkoutOperationId: undefined,
      checkoutReservedAt: undefined,
      checkoutEmail: undefined,
      checkoutName: undefined,
      checkoutSiteUrl: undefined,
      updatedAt: Date.now(),
    })
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
    checkoutOperationId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    eventCreatedAt: v.optional(v.number()),
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
      ((existing?.checkoutSessionId && args.checkoutSessionId !== existing.checkoutSessionId) ||
        (existing?.status === 'checkout_creating' &&
          existing.checkoutOperationId &&
          args.checkoutOperationId !== existing.checkoutOperationId))
    const unboundSubscription =
      !checkoutEvent &&
      (existing?.status === 'checkout_pending' || existing?.status === 'checkout_creating') &&
      !existing.stripeSubscriptionId
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

    const incomingAt = args.eventCreatedAt ?? Date.now()
    const incomingTerminal = isTerminalStripeSubscription(args.status)
    const existingTerminal = Boolean(existing && isTerminalStripeSubscription(existing.status))
    const staleEvent = Boolean(
      existing &&
      existing.lastEventCreatedAt !== undefined &&
      (incomingAt < existing.lastEventCreatedAt ||
        (incomingAt === existing.lastEventCreatedAt && existingTerminal && !incomingTerminal))
    )
    if (staleEvent) {
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
      lastEventCreatedAt: incomingAt,
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
