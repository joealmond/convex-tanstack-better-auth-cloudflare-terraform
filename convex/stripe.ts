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

    const existing = await ctx.runQuery(internal.billing.getByOwner, { ownerId: ctx.userId })
    const deleting = await ctx.runQuery(internal.billing.getDeletionTombstone, {
      ownerId: ctx.userId,
    })
    if (deleting) throw new ConvexError('This account is being deleted')
    if (canStillCharge(existing))
      throw new ConvexError(
        'Manage your existing Stripe subscription in the billing portal before starting another Checkout session.'
      )

    const stripe = createStripeClient()
    let customerId = existing?.stripeCustomerId
    if (!customerId) {
      const customer = await stripeRequest(() =>
        stripe.customers.create({
          email: ctx.user.email,
          name: ctx.user.name,
          metadata: { userId: ctx.userId },
        })
      )
      customerId = customer.id
    }

    const session = await stripeRequest(() =>
      stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        client_reference_id: ctx.userId,
        metadata: { userId: ctx.userId },
        subscription_data: { metadata: { userId: ctx.userId } },
        success_url: `${siteUrl}/examples/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/examples/billing?checkout=cancelled`,
      })
    )
    if (!session.url) throw new ConvexError('Stripe did not return a Checkout URL')

    await ctx.runMutation(internal.billing.saveCheckout, {
      ownerId: ctx.userId,
      stripeCustomerId: customerId,
      checkoutSessionId: session.id,
      priceId,
    })
    return { url: session.url }
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
          status:
            event.type === 'checkout.session.expired'
              ? 'checkout_expired'
              : (subscription?.status ?? 'checkout_completed'),
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
