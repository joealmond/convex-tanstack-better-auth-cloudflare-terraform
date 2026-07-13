# Stripe Billing

The working subscription example is `/examples/billing`. Checkout, portal, and webhook code lives
in `convex/stripe.ts`; subscription persistence lives in `convex/billing.ts`.

## Configure

Create one recurring Price in Stripe, then set server-only Convex variables:

```bash
npx convex env set STRIPE_SECRET_KEY "sk_test_..."
npx convex env set STRIPE_WEBHOOK_SECRET "whsec_..."
npx convex env set STRIPE_PRICE_ID "price_..."
npx convex env set SITE_URL "https://your-app.example"
```

Register this endpoint for the preview or production Convex deployment:

```text
https://<deployment>.convex.site/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Security model

- The browser never supplies a Price ID. `STRIPE_PRICE_ID` is selected on the server.
- Checkout and portal actions require an authenticated Convex identity.
- The webhook reads the raw body once, caps it at 1 MiB, and verifies `Stripe-Signature` before any
  mutation runs.
- Processed Stripe event IDs are stored in `stripeEvents`; retries are idempotent.
- Subscription ownership comes from server-created metadata, not a browser field.
- Secret keys, webhook secrets, and provider error bodies are never returned to clients.

## Local webhook test

```bash
stripe listen --forward-to https://<deployment>.convex.site/api/stripe/webhook
stripe trigger checkout.session.completed
```

Use Stripe test mode and verify the current subscription updates in `/examples/billing`. The unit
suite covers idempotent event application and rejects checkout/webhook calls when secrets are
missing.

## Production checklist

- Rotate test keys to restricted production keys.
- Configure separate webhook endpoints and Prices for preview and production.
- Set the Stripe customer portal policy and allowed return domains.
- Monitor webhook failure and retry rates.
- Add product-specific entitlement checks; a UI showing `active` is not authorization by itself.
