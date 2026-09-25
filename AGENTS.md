## Imported Claude Cowork project instructions

## Effect (required)

Our goal is stable, predictable, high-quality code as AI agents write more of this project. Use Effect to make application workflows, failures, dependencies, and lifecycles explicit so agent-written changes are easier to reason about and verify.

- Use Effect for new or changed nontransactional application workflows and integrations, including external I/O, timeouts, retries, resource lifecycles, and concurrency. Run programs at Convex, TanStack, and Cloudflare boundaries; keep those framework adapters and React UI in their native APIs. Keep Convex queries and mutations native so their database work remains deterministic and transactional. Small pure helpers may remain plain functions.
- This template uses `effect@3.22.2`. Before writing or reviewing Effect code, read `docs/EFFECT.md`, inspect the installed package types, and use the [Effect v3 documentation](https://effect.website/docs/v3/). Do not apply v4 or `main` examples to v3 code.
- Preserve existing behavior during migration. Verify affected tests and typecheck. Do not retry a stream after output is persisted unless the operation has an idempotency design.
