# Stripe Billing

The working subscription example is `/examples/billing`. Checkout, portal, and webhook code lives
in `convex/stripe.ts`; subscription persistence lives in `convex/billing.ts`.

## Configure

Create one recurring Price in Stripe, then set server-only Convex variables:

```bash
npx convex env set STRIPE_SECRET_KEY  # paste at the prompt
npx convex env set STRIPE_WEBHOOK_SECRET  # paste at the prompt
npx convex env set STRIPE_PRICE_ID "price_..."
npx convex env set SITE_URL "https://your-app.example"
```

Register this endpoint for the preview or production Convex deployment:

```text
https://<deployment>.convex.site/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Account deletion is blocked while a subscription can charge or a Checkout session can still complete. The user must cancel in the Stripe portal and wait for a terminal webhook, or wait for a pending Checkout session to expire. The template does not cancel subscriptions automatically. Better Auth's final deletion hook creates a ten-minute Checkout-blocking lease, checks Stripe, then creates the minimal billing tombstone only in its confirmed `afterDelete` callback. A failed guard releases the lease; an interrupted identity deletion expires it. Tombstones are retained indefinitely: expiring one would let late webhooks recreate a deleted owner.
Deletion also checks Stripe's current subscriptions and open Checkout sessions for the recorded customer. If Stripe cannot be reached, deletion stops and can be retried. Configure `STRIPE_SECRET_KEY` for this check before enabling billing.

## Security model

- The browser never supplies a Price ID. `STRIPE_PRICE_ID` is selected on the server.
- Checkout and portal actions require an authenticated Convex identity.
- The webhook reads the raw body once, caps it at 1 MiB, and verifies `Stripe-Signature` before any
  mutation runs.
- Processed Stripe event IDs are stored in `stripeEvents`; retries are idempotent. The daily job removes IDs older than 35 days, longer than Stripe's normal retry window. Tombstones are excluded from that cleanup.
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

The included route is a working integration example, not a complete paid-access system. It rejects a second Checkout while a session or subscription can still charge and binds webhook updates to the current Checkout/subscription IDs. Durable reservations, stable idempotency keys, provider reconciliation, and provider event timestamps protect concurrent calls and delayed events. Do not use this table as a paid entitlement until the product-specific rules below are implemented and tested.

For a subscription product, build these parts before enabling charges:

1. Persist a checkout attempt before the Stripe call. Give it a stable idempotency key, keep the original price/customer/return destination on retries, and reuse or reconcile an open session. Reject a second active subscription. Keep the customer portal working when new checkout is disabled. This template reuses a key only within a conservative 23-hour Stripe idempotency window; an older ambiguous attempt requires reconciliation instead of silently creating another provider object.
2. Fetch and validate the configured Price on the server. The browser chooses only a known plan option; it never sends a Price ID, amount, customer ID, or return URL. Keep test/live mode, Price IDs, webhook secret, and app origin paired per deployment.
3. Verify the signed, bounded webhook body as this example does, then reconcile current Stripe subscription/invoice state from provider IDs. Store processed event IDs and durable retry state. A success redirect never grants access.
4. Define one server-side entitlement function from recognized product prices, subscription state, and paid-through time. Use it at every paid Convex function, not just to hide UI controls. Include previously sold Price IDs when changing plans.
5. Model invoice, refund, dispute, account export/deletion, retention, and customer-support handling for the actual business and jurisdiction. If issuing external accounting documents, use stable external IDs and reconcile an ambiguous provider result before retrying creation.

Minimum tests: concurrent Checkout and retry, duplicate/out-of-order webhooks, failed payment and cancellation, mismatched customer/Price IDs, stale client redirects, and account deletion while a subscription is active. Finish with Stripe sandbox checks against the deployed backend and webhook endpoint. Ujfocim's invoicing, tax, legal text, and native-store policy are specific to that product.

## Recover an uncertain Checkout

Checkout inputs are frozen before Stripe I/O. Retries reuse the operation's keys for at most
23 hours; they never issue a fresh provider create after the idempotency window. Recovery
reads the complete customer session/subscription history with a 100-page/45-second limit. A
partial page, timeout, ownership mismatch, or another payable session retains the operation.

Run the internal `stripe:reconcileCheckout` action in the Convex dashboard with the owner ID.
It records an open session, an expired session, or the current completed subscription state.
Expired sessions permit another Checkout; active subscriptions continue to block it.

If the customer-create response was lost before its ID was stored, inspect Stripe for the
customer with the existing `metadata.userId` matching that owner and the reservation's creation
time. Supply that exact `stripeCustomerId` to reconciliation. It verifies ownership and
creation time; it does not create provider objects. Do not guess an ID or reuse another account's
customer. No additional customer metadata is exported for this recovery path.

If the verified customer has no matching session, first check the original operation in Stripe.
Only then invoke the internal action with `confirmNoCheckout: true` and the exact
`expectedOperationId` from the billing row. It exhausts all provider pages and verifies no open
sessions or live subscriptions before releasing the reservation. This confirmation is an
operator assertion about the original request, not a public browser capability.
