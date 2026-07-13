import Stripe from 'stripe'
import { ConvexError } from 'convex/values'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { authAction } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'

const MAX_WEBHOOK_BYTES = 1_000_000

function createStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new ConvexError('STRIPE_SECRET_KEY is not configured')
  return new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() })
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

export const createCheckout = authAction({
  args: {},
  handler: async (ctx) => {
    const priceId = process.env.STRIPE_PRICE_ID
    const siteUrl = publicSiteUrl()
    if (!priceId || !/^price_[a-zA-Z0-9]+$/.test(priceId)) {
      throw new ConvexError('STRIPE_PRICE_ID is not configured with a valid Stripe Price ID')
    }
    await rateLimiter.limit(ctx, 'stripeSession', { key: ctx.userId, throws: true })

    const stripe = createStripeClient()
    const existing = await ctx.runQuery(internal.billing.getByOwner, { ownerId: ctx.userId })
    let customerId = existing?.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        name: ctx.user.name,
        metadata: { userId: ctx.userId },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
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
  handler: async (ctx) => {
    const siteUrl = publicSiteUrl()
    await rateLimiter.limit(ctx, 'stripeSession', { key: ctx.userId, throws: true })
    const billing = await ctx.runQuery(internal.billing.getByOwner, { ownerId: ctx.userId })
    if (!billing?.stripeCustomerId) throw new ConvexError('No Stripe customer exists yet')
    const session = await createStripeClient().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${siteUrl}/examples/billing`,
    })
    return { url: session.url }
  },
})

async function readBoundedBody(request: Request) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let body = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_WEBHOOK_BYTES) throw new Error('Webhook payload is too large')
    body += decoder.decode(value, { stream: true })
  }
  return body + decoder.decode()
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
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const customerId = id(session.customer)
      if (customerId) {
        await ctx.runMutation(internal.billing.applyStripeEvent, {
          eventId: event.id,
          eventType: event.type,
          ownerId: session.metadata?.userId || session.client_reference_id || undefined,
          stripeCustomerId: customerId,
          stripeSubscriptionId: id(session.subscription) || undefined,
          checkoutSessionId: session.id,
          status: 'checkout_completed',
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
    return new Response('Invalid webhook', { status: 400 })
  }
})
