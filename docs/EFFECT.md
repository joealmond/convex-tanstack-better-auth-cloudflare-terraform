# Effect in ConvexKit

This template pins `effect@3.22.2`. Use the [Effect v3 documentation](https://effect.website/docs/v3/) and the installed package's TypeScript declarations. The upstream `main` branch and its `LLMS.md` describe v4, so their examples are not version-matched.

Effect programs own the AI stream deadline and cancellation, Resend and Stripe calls, account deletion orchestration, account export, and file upload. Convex actions and React event handlers run these programs at their boundaries. Convex queries and mutations retain native database transactions; React rendering, TanStack routing, and Cloudflare entry points retain their native APIs. Browser Effect code loads only when upload or export is used.

Stripe SDK calls use its own 30-second request timeout. Effect does not interrupt a Checkout or customer creation call independently because an uncertain provider result must be reconciled before retrying it.

The read-only Stripe checks before account deletion have a 45-second total deadline. An SDK read already in flight may finish afterward; the action does not start further reads or run the `provider_clear` write after timeout.

Queued Resend mail uses its delivery ID as an idempotency key. Effect gives each attempt a 10-second deadline and retries only transient failures, at most twice. If the result is still uncertain, the record becomes `unknown`; it is not automatically replayed after Resend's 24-hour idempotency window. Account exports have a five-minute total deadline and can be canceled by the user. Stripe webhook bodies have a 10-second read deadline.

Canceling an export stops later pages and aborts file downloads. A Convex query already in flight may still finish because the query client does not expose an abort signal.

## Further adoption

Do not add automatic Stripe Checkout retries until a durable operation ID and reconciliation path exist. Upload transfer cancellation is also deferred: storage can accept bytes before the browser receives a storage ID, leaving no ID with which to clean up an uncertain upload.

## Pilot measurement

The AI stream in `convex/ai.ts` was measured before and after adding Effect on the same machine with warm dependencies. The pilot preserved prompt validation, rate limiting, ownership, model override, SSE/output limits, and persisted states. New tests cover request timeout, malformed stream cancellation, and output-limit cancellation.

| Check               |                    Before |            AI pilot after |
| ------------------- | ------------------------: | ------------------------: |
| Typecheck wall time |              2.97 s, PASS |              2.86 s, PASS |
| Test wall time      |           1.54 s, 73 PASS |           1.38 s, 76 PASS |
| Build wall time     |              4.22 s, PASS |              3.83 s, PASS |
| AI browser chunk    |    4.17 kB / 1.82 kB gzip |    4.17 kB / 1.82 kB gzip |
| Main server entry   | 312.95 kB / 97.04 kB gzip | 312.95 kB / 97.04 kB gzip |

These single-run timings are regression checks, not a performance claim. No live provider latency or cost was measured. The browser conversion adds an on-demand `effect-runtime` chunk of about 37 kB gzip; it is not part of the initial AI page load. Streaming responses are not retried because output may already be persisted.
