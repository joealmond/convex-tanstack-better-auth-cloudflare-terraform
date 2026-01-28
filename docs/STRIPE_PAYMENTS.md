# Stripe Payments Guide

Integrate subscription payments and billing using Stripe with Convex.

## Why Stripe + Convex?

- ✅ **Webhooks auto-handled** - Stripe events synced to Convex DB
- ✅ **Real-time queries** - Query payments, subscriptions, invoices
- ✅ **Transactional** - Payment logic rolls back on errors
- ✅ **Type-safe** - Full TypeScript support

## Quick Start

###  Setup

1. Sign up at [stripe.com](https://stripe.com)
2. Get API keys from Dashboard → Developers → API keys
3. Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

4. Install Stripe:

```bash
npm install stripe
```

## Basic Checkout Flow

### 1. Create Checkout Session

```typescript
// convex/payments.ts
'use node'
import { action } from './_generated/server'
import Stripe from 'stripe'
import { v } from 'convex/values'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export const createCheckoutSession = action({
  args: {
    priceId: v.string(), // Stripe Price ID
  },
  handler: async (ctx, args) => {
    // Get current user from Better Auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: args.priceId,
        quantity: 1,
      }],
      success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/pricing`,
      customer_email: identity.email,
      metadata: {
        userId: identity.subject,
      },
    })

    return { url: session.url }
  },
})
```

### 2. Frontend Usage

```typescript
// src/components/PricingCard.tsx
import { useConvexAction } from '@/lib/hooks/useConvexMutation'
import { api } from '@/convex/_generated/api'

export function PricingCard() {
  const createCheckout = useConvexAction(api.payments.createCheckoutSession)

  const handleSubscribe = async () => {
    const { url } = await createCheckout.execute({
      priceId: 'price_xxxxx', // Your Stripe Price ID
    })
    
    if (url) {
      window.location.href = url
    }
  }

  return (
    <button onClick={handleSubscribe}>
      Subscribe Now
    </button>
  )
}
```

## Webhook Handling

### 1. Create Webhook Endpoint

```typescript
// convex/http.ts
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const handleStripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        await ctx.runMutation(internal.payments.handleCheckoutCompleted, {
          sessionId: session.id,
          userId: session.metadata?.userId,
        })
        break

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object
        await ctx.runMutation(internal.payments.updateSubscription, {
          subscriptionId: subscription.id,
          status: subscription.status,
        })
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Webhook error', { status: 400 })
  }
})

const http = httpRouter()
http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: handleStripeWebhook,
})

export default http
```

### 2. Handle Webhook Events

```typescript
// convex/payments.ts
import { internalMutation } from './_generated/server'

export const handleCheckoutCompleted = internalMutation({
  args: { sessionId: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Store subscription in database
    await ctx.db.insert('subscriptions', {
      userId: args.userId!,
      stripeSessionId: args.sessionId,
      status: 'active',
      createdAt: Date.now(),
    })
  },
})

export const updateSubscription = internalMutation({
  args: {
    subscriptionId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .filter((q) => q.eq(q.field('stripeSubscriptionId'), args.subscriptionId))
      .first()

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: args.status,
        updatedAt: Date.now(),
      })
    }
  },
})
```

## Check Subscription Status

```typescript
// convex/subscriptions.ts
export const getMySubscription = query({
  handler: async (ctx) => {
    const user = await requireAuth(ctx)
    
    return await ctx.db
      .query('subscriptions')
      .filter((q) => 
        q.and(
          q.eq(q.field('userId'), user._id),
          q.eq(q.field('status'), 'active')
        )
      )
      .first()
  },
})
```

## Customer Portal

Let users manage billing:

```typescript
// convex/payments.ts
export const createPortalSession = action({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Get Stripe customer ID from subscription
    const subscription = await ctx.runQuery(api.subscriptions.getMySubscription)
    if (!subscription?.stripeCustomerId) {
      throw new Error('No subscription found')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.SITE_URL}/dashboard`,
    })

    return { url: session.url }
  },
})
```

## Test Mode

Use Stripe test cards:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Authentication Required: `4000 0025 0000 3155`

## Best Practices

- ✅ Use webhook secrets to verify events
- ✅ Store subscription status in Convex DB
- ✅ Handle all subscription lifecycle events
- ✅ Use test mode for development
- ✅ Implement customer portal for self-service

See [Stripe Docs](https://stripe.com/docs) for more details.
