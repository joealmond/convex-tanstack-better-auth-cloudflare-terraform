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

## What the larger product taught us

The included route is a working integration example, not a complete paid-access system. Repeated Checkout requests can create multiple sessions; `saveCheckout` can replace an existing subscription status with `checkout_pending`; and event-ID deduplication alone does not protect against older events arriving after newer ones. Do not use this table as a paid entitlement until the product-specific rules below are implemented and tested.

For a subscription product, build these parts before enabling charges:

1. Persist a checkout attempt before the Stripe call. Give it a stable idempotency key, keep the original price/customer/return destination on retries, and reuse or reconcile an open session. Reject a second active subscription. Keep the customer portal working when new checkout is disabled.
2. Fetch and validate the configured Price on the server. The browser chooses only a known plan option; it never sends a Price ID, amount, customer ID, or return URL. Keep test/live mode, Price IDs, webhook secret, and app origin paired per deployment.
3. Verify the signed, bounded webhook body as this example does, then reconcile current Stripe subscription/invoice state from provider IDs. Store processed event IDs and durable retry state. A success redirect never grants access.
4. Define one server-side entitlement function from recognized product prices, subscription state, and paid-through time. Use it at every paid Convex function, not just to hide UI controls. Include previously sold Price IDs when changing plans.
5. Model invoice, refund, dispute, account export/deletion, retention, and customer-support handling for the actual business and jurisdiction. If issuing external accounting documents, use stable external IDs and reconcile an ambiguous provider result before retrying creation.

Minimum tests: concurrent Checkout and retry, duplicate/out-of-order webhooks, failed payment and cancellation, mismatched customer/Price IDs, stale client redirects, and account deletion while a subscription is active. Finish with Stripe sandbox checks against the deployed backend and webhook endpoint. Ujfocim's invoicing, tax, legal text, and native-store policy are specific to that product.
