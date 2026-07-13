# Transactional Email with Resend

The working example is `/examples/email`. Queue/status mutations live in `convex/emails.ts`, while
the Node action that calls Resend lives in `convex/emailActions.ts`.

## Configure

Verify a sending domain in Resend, then set Convex variables:

```bash
npx convex env set RESEND_API_KEY "re_..."
npx convex env set RESEND_FROM_EMAIL "ConvexKit <hello@your-domain.example>"
```

For a first test you can use Resend's onboarding sender within the provider's documented limits.

## How it works

1. Better Auth's user-create hook schedules `emails.enqueueWelcome` after the account transaction.
2. The mutation creates a queued `emailDeliveries` record and schedules the Node action.
3. The action reads the API key on the server, escapes user-controlled HTML, sends through Resend,
   and records `sent` or `error` status.
4. The authenticated example page subscribes to the current user's delivery history and can enqueue
   a test email subject to the `sendEmail` rate limit.

## Security and delivery notes

- Never expose `RESEND_API_KEY` through a `VITE_` variable.
- Delivery records are owner-scoped; the public API cannot list another user's email.
- User name and other interpolated content must remain HTML-escaped.
- A provider acceptance ID means accepted for delivery, not guaranteed inbox placement.
- Configure SPF, DKIM, and DMARC for your sending domain and monitor bounces/complaints.

## Testing

`convex/integrations.test.ts` verifies queueing and the safe missing-key failure path without sending
real mail. Live delivery tests should use a dedicated provider account and should not run for
untrusted pull requests.
