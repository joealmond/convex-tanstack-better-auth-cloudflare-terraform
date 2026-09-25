# Transactional Email with Resend

The working example is `/examples/email`. Queue/status mutations live in `convex/emails.ts`, while
the action that calls Resend lives in `convex/emailActions.ts`.

## Configure

Verify a sending domain in Resend, then set Convex variables:

```bash
npx convex env set RESEND_API_KEY  # paste at the prompt
npx convex env set RESEND_FROM_EMAIL "ConvexKit <hello@your-domain.example>"
```

For a first test you can use Resend's onboarding sender within the provider's documented limits.

## How it works

1. Better Auth's user-create hook schedules `emails.enqueueWelcome` after the account transaction.
2. The mutation creates a queued `emailDeliveries` record and schedules the action.
3. The action reads the API key on the server, escapes user-controlled HTML, and sends with a stable
   Resend idempotency key derived from the delivery ID. Effect retries transient failures at most twice.
4. It records `sent` for confirmed acceptance, `error` for a known rejection, or `unknown` when the
   result remains uncertain after three attempts or the status write fails. An `unknown` delivery is
   not automatically resent.
5. The authenticated example page subscribes to the current user's delivery history and can enqueue
   a test email subject to the `sendEmail` rate limit.

## Security and delivery notes

- Never expose `RESEND_API_KEY` through a `VITE_` variable.
- Delivery records are owner-scoped; the public API cannot list another user's email.
- User name and other interpolated content must remain HTML-escaped.
- A provider acceptance ID means accepted for delivery, not guaranteed inbox placement.
- Resend retains idempotency keys for 24 hours. Do not replay a delivery later without checking its
  outcome; a later send can duplicate mail.
- Configure SPF, DKIM, and DMARC for your sending domain and monitor bounces/complaints.

## Testing

`convex/integrations.test.ts` verifies queueing, idempotency keys, bounded retries, timeout, and the
safe missing-key path without sending real mail. Live delivery tests should use a dedicated provider
account and should not run for untrusted pull requests.
