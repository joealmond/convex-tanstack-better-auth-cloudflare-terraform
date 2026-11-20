import Stripe from 'stripe'
import { ConvexError } from 'convex/values'
import { v } from 'convex/values'
import { Effect } from 'effect'
import { internal } from './_generated/api'
import { canStillCharge, isTerminalStripeSubscription } from './billing'
import { httpAction } from './_generated/server'
import { authAction, internalAction } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'
import { runEffect } from './lib/runEffect'

const MAX_WEBHOOK_BYTES = 1_000_000
const WEBHOOK_BODY_TIMEOUT_MS = 10_000
const STRIPE_REQUEST_TIMEOUT_MS = 30_000
const PROVIDER_CHECK_TIMEOUT_MS = 45_000
const STRIPE_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000

class WebhookBodyTimeoutError extends Error {}

function stripeRequest<A>(request: () => Promise<A>) {
  return runEffect(Effect.tryPromise({ try: request, catch: (error) => error }))
}

function createStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new ConvexError('STRIPE_SECRET_KEY is not configured')
  return new Stripe(secret, {
    httpClient: Stripe.createFetchHttpClient(),
    timeout: STRIPE_REQUEST_TIMEOUT_MS,
  })
}

function publicSiteUrl() {
  const configured = (process.env.SITE_URL || '').replace(/\/$/, '')
  if (!configured) throw new ConvexError('SITE_URL is not configured')
  try {
    const url = new URL(configured)
    const isLocalHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocalHttp) throw new Error('invalid protocol')
    return url.toString().replace(/\/$/, '')
  } catch {
    throw new ConvexError('SITE_URL must be an HTTPS URL or a local development URL')
  }
}

/** A live, read-only provider check before removing an account with billing history. */
export const assertNoProviderObligations = internalAction({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const billing = await ctx.runQuery(internal.billing.getByOwner, { ownerId })
    const tombstone = billing
      ? null
      : await ctx.runQuery(internal.billing.getDeletionTombstone, { ownerId })
    const customerId = billing?.stripeCustomerId ?? tombstone?.stripeCustomerId
    if (!customerId) return
    const stripe = createStripeClient()
    await runEffect(
      Effect.tryPromise({
        try: async (signal) => {
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 100,
          })
          signal.throwIfAborted()
          if (
            subscriptions.has_more ||
            subscriptions.data.some(
              (subscription) => !isTerminalStripeSubscription(subscription.status)
            )
          ) {
            throw new ConvexError('Cancel all Stripe subscriptions before deleting this account')
          }
          const openCheckouts = await stripe.checkout.sessions.list({
            customer: customerId,
            status: 'open',
            limit: 1,
          })
          signal.throwIfAborted()
          if (openCheckouts.data.length || openCheckouts.has_more)
            throw new ConvexError(
              'Wait for open Stripe Checkout sessions to expire before deletion'
            )
          if (billing?.checkoutSessionId && canStillCharge(billing)) {
            // The session may have completed between the subscription and open-session lists.
            const session = await stripe.checkout.sessions.retrieve(billing.checkoutSessionId)
            signal.throwIfAborted()
            if (session.status === 'open')
              throw new ConvexError(
                'Wait for open Stripe Checkout sessions to expire before deletion'
              )
            if (session.status === 'complete') {
              const subscriptionId = id(session.subscription)
              if (!subscriptionId)
                throw new ConvexError('Stripe Checkout completion is not reconciled yet')
              const subscription = await stripe.subscriptions.retrieve(subscriptionId)
              signal.throwIfAborted()
              if (!isTerminalStripeSubscription(subscription.status))
                throw new ConvexError(
                  'Cancel all Stripe subscriptions before deleting this account'
                )
            } else if (session.status !== 'expired') {
              throw new ConvexError('Stripe Checkout status is not reconciled yet')
            }
          }
        },
        catch: (error) => error,
      }).pipe(
        Effect.timeoutFail({
          duration: PROVIDER_CHECK_TIMEOUT_MS,
          onTimeout: () =>
            new ConvexError('Unable to confirm Stripe billing status; retry deletion'),
        })
      )
    )
    if (billing && canStillCharge(billing))
      await ctx.runMutation(internal.billing.markProviderClear, {
        ownerId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: billing.stripeSubscriptionId,
        checkoutSessionId: billing.checkoutSessionId,
      })
  },
})

export const createCheckout = authAction({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const priceId = process.env.STRIPE_PRICE_ID
    const siteUrl = publicSiteUrl()
    if (!priceId || !/^price_[a-zA-Z0-9]+$/.test(priceId)) {
      throw new ConvexError('STRIPE_PRICE_ID is not configured with a valid Stripe Price ID')
    }
    await rateLimiter.limit(ctx, 'stripeSession', { key: ctx.userId, throws: true })

    const stripe = createStripeClient()
    const reserved = await ctx.runMutation(internal.billing.reserveCheckout, {
      ownerId: ctx.userId,
      priceId,
      email: ctx.user.email,
      name: ctx.user.name,
      siteUrl,
    })
    if (
      reserved.checkoutReservedAt === undefined ||
      Date.now() - reserved.checkoutReservedAt > STRIPE_IDEMPOTENCY_WINDOW_MS
    ) {
      const recovered = await ctx.runAction(internal.stripe.reconcileCheckout, {
        ownerId: ctx.userId,
      })
      if (recovered.url) return { url: recovered.url }
      throw new ConvexError(
        'This Checkout attempt needs Stripe reconciliation before a new attempt can be started.'
      )
    }

    let customerId = reserved.stripeCustomerId
    if (!reserved.priceId) throw new ConvexError('Checkout reservation is missing its price')
    if (!customerId) {
      const customer = await stripeRequest(() =>
        stripe.customers.create(
          {
            email: reserved.checkoutEmail ?? ctx.user.email,
            name: reserved.checkoutName ?? ctx.user.name,
            metadata: { userId: ctx.userId },
          },
          { idempotencyKey: `convexkit-customer-${reserved.checkoutOperationId}` }
        )
      )
      customerId = customer.id
      await ctx.runMutation(internal.billing.recordCheckoutCustomer, {
        ownerId: ctx.userId,
        checkoutOperationId: reserved.checkoutOperationId,
        stripeCustomerId: customerId,
      })
    }

    const session = await stripeRequest(() =>
      stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: customerId,
          line_items: [{ price: reserved.priceId, quantity: 1 }],
          allow_promotion_codes: true,
          client_reference_id: ctx.userId,
          metadata: { userId: ctx.userId, checkoutOperationId: reserved.checkoutOperationId },
          subscription_data: { metadata: { userId: ctx.userId } },
          success_url: `${reserved.checkoutSiteUrl ?? siteUrl}/examples/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${reserved.checkoutSiteUrl ?? siteUrl}/examples/billing?checkout=cancelled`,
        },
        { idempotencyKey: `convexkit-checkout-${reserved.checkoutOperationId}` }
      )
    )
    if (!session.url) throw new ConvexError('Stripe did not return a Checkout URL')

    await ctx.runMutation(internal.billing.saveCheckout, {
      ownerId: ctx.userId,
      stripeCustomerId: customerId,
      checkoutSessionId: session.id,
      priceId: reserved.priceId,
      checkoutOperationId: reserved.checkoutOperationId,
    })
    return { url: session.url }
  },
})

/** Read-only recovery. Unknown customer IDs require a verified operator-supplied ID. */
export const reconcileCheckout = internalAction({
  args: {
    ownerId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    expectedOperationId: v.optional(v.string()),
    confirmNoCheckout: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ status: string; url: string | undefined }> => {
    const billing = await ctx.runQuery(internal.billing.getByOwner, { ownerId: args.ownerId })
    if (!billing) throw new ConvexError('No billing operation exists')
    const customerId = billing.stripeCustomerId ?? args.stripeCustomerId
    if (!customerId)
      throw new ConvexError(
        'Supply the Stripe customer ID after checking its userId metadata in Stripe'
      )
    if (
      args.stripeCustomerId &&
      billing.stripeCustomerId &&
      args.stripeCustomerId !== billing.stripeCustomerId
    )
      throw new ConvexError('The supplied customer does not match the billing record')
    if (
      args.confirmNoCheckout &&
      (!args.expectedOperationId || args.expectedOperationId !== billing.checkoutOperationId)
    )
      throw new ConvexError('Confirm the exact Checkout operation before releasing it')
    const stripe = createStripeClient()
    const result = await runEffect(
      Effect.tryPromise({
        try: async (signal) => {
          const customer = await stripe.customers.retrieve(customerId)
          signal.throwIfAborted()
          if (customer.deleted || customer.metadata.userId !== args.ownerId)
            throw new ConvexError('Stripe customer ownership could not be verified')
          if (
            !billing.stripeCustomerId &&
            customer.created * 1_000 < (billing.checkoutReservedAt ?? 0) - 1_000
          )
            throw new ConvexError('The supplied customer predates this Checkout operation')

          // Exhaust every page before concluding absence. A cap/timeout never releases the operation.
          async function listAll<T extends { id: string }>(
            page: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>
          ) {
            const records: T[] = []
            let cursor: string | undefined
            for (let attempt = 0; attempt < 100; attempt++) {
              const result = await page(cursor)
              signal.throwIfAborted()
              records.push(...result.data)
              if (!result.has_more) return records
              const next = result.data.at(-1)?.id
              if (!next || next === cursor)
                throw new ConvexError('Stripe pagination did not advance')
              cursor = next
            }
            throw new ConvexError(
              'Stripe reconciliation exceeded its page limit; operation retained'
            )
          }
          const sessions = await listAll<Stripe.Checkout.Session>((starting_after) =>
            stripe.checkout.sessions.list({ customer: customerId, limit: 100, starting_after })
          )
          const matching = sessions.filter((session) =>
            billing.checkoutSessionId
              ? session.id === billing.checkoutSessionId
              : Boolean(
                  billing.checkoutOperationId &&
                  session.metadata?.checkoutOperationId === billing.checkoutOperationId
                )
          )
          if (matching.length > 1)
            throw new ConvexError('Multiple Stripe sessions need operator review')
          const session = matching[0]
          if (session && (session.metadata?.userId || session.client_reference_id) !== args.ownerId)
            throw new ConvexError('Stripe Checkout ownership could not be verified')
          if (
            sessions.some(
              (candidate) => candidate.status === 'open' && candidate.id !== session?.id
            )
          )
            throw new ConvexError('Another open Stripe Checkout must be resolved first')
          const subscriptions = await listAll<Stripe.Subscription>((starting_after) =>
            stripe.subscriptions.list({
              customer: customerId,
              status: 'all',
              limit: 100,
              starting_after,
            })
          )
          const subscriptionId = session ? id(session.subscription) : undefined
          if (
            subscriptions.some(
              (subscription) =>
                subscription.id !== subscriptionId &&
                !isTerminalStripeSubscription(subscription.status)
            )
          )
            throw new ConvexError('Other Stripe subscriptions must be resolved first')
          if (!session) {
            if (!args.confirmNoCheckout)
              throw new ConvexError(
                'No matching session was found; operator confirmation is required'
              )
            return {
              status: 'provider_clear',
              checkoutSessionId: undefined,
              stripeSubscriptionId: undefined,
              currentPeriodEnd: undefined,
              url: undefined,
            }
          }
          if (session.status === 'open')
            return {
              status: 'checkout_pending',
              checkoutSessionId: session.id,
              stripeSubscriptionId: undefined,
              currentPeriodEnd: undefined,
              url: session.url ?? undefined,
            }
          if (session.status === 'expired')
            return {
              status: 'checkout_expired',
              checkoutSessionId: session.id,
              stripeSubscriptionId: undefined,
              currentPeriodEnd: undefined,
              url: undefined,
            }
          if (session.status !== 'complete' || !subscriptionId)
            throw new ConvexError('Stripe Checkout completion is not reconciled yet')
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          signal.throwIfAborted()
          if (id(subscription.customer) !== customerId)
            throw new ConvexError('Stripe subscription customer does not match')
          return {
            status: subscription.status,
            checkoutSessionId: session.id,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: subscription.items.data[0]?.current_period_end
              ? subscription.items.data[0].current_period_end * 1_000
              : undefined,
            url: undefined,
          }
        },
        catch: (error) => error,
      }).pipe(
        Effect.timeoutFail({
          duration: PROVIDER_CHECK_TIMEOUT_MS,
          onTimeout: () => new ConvexError('Stripe reconciliation timed out; operation retained'),
        })
      )
    )
    await ctx.runMutation(internal.billing.commitCheckoutReconciliation, {
      ownerId: args.ownerId,
      expectedUpdatedAt: billing.updatedAt,
      expectedStatus: billing.status,
      expectedOperationId: billing.checkoutOperationId,
      expectedSessionId: billing.checkoutSessionId,
      stripeCustomerId: customerId,
      checkoutSessionId: result.checkoutSessionId,
      stripeSubscriptionId: result.stripeSubscriptionId,
      status: result.status,
      currentPeriodEnd: result.currentPeriodEnd,
    })
    return { status: result.status, url: result.url }
  },
})

export const createPortal = authAction({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const siteUrl = publicSiteUrl()
    await rateLimiter.limit(ctx, 'stripeSession', { key: ctx.userId, throws: true })
    const billing = await ctx.runQuery(internal.billing.getByOwner, { ownerId: ctx.userId })
    if (!billing?.stripeCustomerId) throw new ConvexError('No Stripe customer exists yet')
    const session = await stripeRequest(() =>
      createStripeClient().billingPortal.sessions.create({
        customer: billing.stripeCustomerId,
        return_url: `${siteUrl}/examples/billing`,
      })
    )
    return { url: session.url }
  },
})

function readBoundedBody(request: Request) {
  if (!request.body) return Promise.resolve('')
  const reader = request.body.getReader()
  return runEffect(
    Effect.tryPromise({
      try: async (signal) => {
        const decoder = new TextDecoder()
        let size = 0
        let body = ''
        const cancel = () => void reader.cancel().catch(() => {})
        signal.addEventListener('abort', cancel, { once: true })
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_WEBHOOK_BYTES) throw new Error('Webhook payload is too large')
            body += decoder.decode(value, { stream: true })
          }
          return body + decoder.decode()
        } finally {
          signal.removeEventListener('abort', cancel)
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
      },
      catch: (error) => error,
    }).pipe(
      Effect.timeoutFail({
        duration: WEBHOOK_BODY_TIMEOUT_MS,
        onTimeout: () => new WebhookBodyTimeoutError('Webhook body read timed out'),
      })
    )
  )
}

function id(value: string | { id: string } | null) {
  return typeof value === 'string' ? value : value?.id
}

export const webhook = httpAction(async (ctx, request) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!webhookSecret || !signature)
    return new Response('Webhook is not configured', { status: 400 })

  try {
    const payload = await readBoundedBody(request)
    const stripe = createStripeClient()
    const event = await stripeRequest(() =>
      stripe.webhooks.constructEventAsync(
        payload,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      )
    )

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
      const session = event.data.object
      const customerId = id(session.customer)
      if (customerId) {
        const subscriptionId = id(session.subscription)
        const subscription =
          event.type === 'checkout.session.completed' && subscriptionId
            ? await stripeRequest(() => stripe.subscriptions.retrieve(subscriptionId))
            : null
        await ctx.runMutation(internal.billing.applyStripeEvent, {
          eventId: event.id,
          eventType: event.type,
          ownerId: session.metadata?.userId || session.client_reference_id || undefined,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId || undefined,
          checkoutSessionId: session.id,
          checkoutOperationId: session.metadata?.checkoutOperationId,
          status:
            event.type === 'checkout.session.expired'
              ? 'checkout_expired'
              : (subscription?.status ?? 'checkout_completed'),
          eventCreatedAt: event.created * 1_000,
        })
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object
      const customerId = id(subscription.customer)
      if (customerId) {
        await ctx.runMutation(internal.billing.applyStripeEvent, {
          eventId: event.id,
          eventType: event.type,
          ownerId: subscription.metadata.userId || undefined,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          priceId: subscription.items.data[0]?.price.id,
          status: subscription.status,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end
            ? subscription.items.data[0].current_period_end * 1_000
            : undefined,
          eventCreatedAt: event.created * 1_000,
        })
      }
    } else {
      // Record unhandled events only in structured logs; Stripe safely retries failures.
      console.log(
        JSON.stringify({ event: 'stripe_webhook_ignored', id: event.id, type: event.type })
      )
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'stripe_webhook_rejected',
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return error instanceof WebhookBodyTimeoutError
      ? new Response('Webhook request timed out', { status: 503 })
      : new Response('Invalid webhook', { status: 400 })
  }
})
