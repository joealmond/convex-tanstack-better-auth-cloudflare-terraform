# From starter to product: reusable decisions

ConvexKit supplies the common stack and examples. These recipes come from building a larger product on it. Use each when the new product needs it; keeping them out of the default runtime avoids unused services and configuration.

## Already automated in generated apps

- Every build removes copied `.env*`, `.dev.vars*`, and client source maps from `dist`, then rejects recognizable private keys and live API keys in text assets. `node scripts/sanitize-build-output.mjs dist --check` checks an existing artifact without changing it. This is a last check, not permission to put secrets in frontend code.
- `npm run check:convex-imports` bundles Convex isolate and `"use node"` modules for their respective runtimes. Run it before deploying after adding backend dependencies. It catches Node-only imports that TypeScript can accept in isolate code.

## Choose these when starting a product

| If the product needs…                   | Set up early                                                                                                                                                                                              | Smallest useful acceptance check                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side fetch of user-provided URLs | A single Node-only fetch boundary with allowed protocols, DNS/IP checks, redirect revalidation, timeouts, size and content-type limits. Never fetch arbitrary URLs directly from actions.                 | Local tests for loopback/private IPs, redirect to a private target, oversized body, and allowed public target.                        |
| User accounts with retained data        | List every user-owned table and external side effect as features are added. Extend deletion and export together; block new writes while deletion runs. Use indexed, bounded, resumable batches.           | Delete a synthetic account with more than one batch and prove another account's records survive. Export counts must match owned rows. |
| AI or other metered providers           | Record each request's provider, model, operation, usage, estimated cost, and outcome server-side. Enforce per-user budgets before calling the provider; distinguish cache hits from new spending.         | A denied-over-budget call performs no provider request; retry does not charge twice.                                                  |
| Paid subscriptions                      | Start from the Stripe example, then add durable checkout attempts, provider idempotency, current-state reconciliation, server-side entitlements, and a sales switch. Keep portal access when sales pause. | Concurrent checkout creates one customer/session; duplicate or out-of-order webhooks cannot change access incorrectly.                |
| More than one language                  | Pick locale storage, fallback locale, and translation-key naming before writing many UI strings. Keep user content separate from interface translations.                                                  | Switch language across a refresh and verify the fallback for a missing key.                                                           |
| Mobile shell or offline mode            | Define web/native adapter boundaries and identity storage first. Treat offline writes as a sync protocol with account-scoped invalidation, not a service-worker switch.                                   | Sign out, switch accounts, lose network, recover, and verify no old-account data appears.                                             |

## Before the first production release

1. Pin the intended production Convex and public app origins in a project-owned environment check. Compare parsed origins and deployment IDs before a production build or deploy. Preview and production must not silently point at each other.
2. Add a public, read-only smoke command for the actual app URL: home response, required security headers, backend health, and anonymous auth response. Bound request time and response size. Keep account creation, payment, AI, and other writes in separate disposable-environment tests.
3. Treat backend and Worker deployment as separate steps. Record the commit, environment, build hash, step outcomes, and smoke result in a retained CI artifact. A successful command is not proof of the remote version; after partial failure, verify the served versions before retry or rollback.
4. Keep logs structured and bounded. Pass stable IDs and error codes, never session tokens, email bodies, provider responses, or full request objects. If adding redaction, test it, but still avoid sending secrets into the logger.
5. For schema changes with existing data, add new fields as optional, deploy code that tolerates both shapes, backfill in bounded batches, verify counts, then require or remove fields in a later deploy. Record the order and recovery path with the change.

## Where to extend this template

- `convex/maintenance.ts` handles the included chat and file records. Add each new user-owned table to account cleanup; inspect the generated version after choosing examples.
- `docs/STRIPE_PAYMENTS.md` describes the billing example and the production upgrades learned from Ujfocim. Its invoicing and contract flow are project-owned.
- `src/lib/logger.ts` is the existing logging boundary. Extend it rather than introducing another logger.
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` is the place to record project-specific release targets and smoke checks.
- `scripts/sanitize-build-output.mjs` and `scripts/check-convex-runtime-imports.mjs` are local, credential-free checks. Keep project policy and provider credentials out of these generic scripts.

The larger product also added Cloudflare rule reconciliation, native builds, billing policy, and legal/account workflows. Those depend on its own domains, provider settings, data model, and obligations; choose and implement them explicitly for each product.
