# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Use a private GitHub security advisory when available, or send a private report to the repository owner with the affected version, reproduction steps, impact, and any proposed mitigation. Expect acknowledgement within three business days. Replace this contact process with a monitored security mailbox before launch.

Security fixes target `main` and the latest release; older forks are not supported.

## Production baseline

- Use GitHub environment protection for production and keep Convex, Cloudflare, OAuth, and email credentials only in their secret stores.
- Give deployment tokens the minimum account, zone, and environment scope; rotate them after staff changes or suspected exposure.
- Keep dependency audit, immutable GitHub Action pins, tests, typecheck, Terraform validation, and the Worker dry run blocking.
- Keep `SITE_URL` and Better Auth `trustedOrigins` exact. Do not add wildcard origins or arbitrary proxy IP headers.
- Preserve server-side upload metadata validation, ownership checks, quotas, bounded queries, application rate limits, and Better Auth's database-backed rate limits.
- Review the CSP when introducing any third-party script or connection. Never loosen it globally to make one integration work.

Rotate exposed secrets first, then patch and deploy; repository history is not a secret store.
