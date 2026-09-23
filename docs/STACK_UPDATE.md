# Stack update — September 2026

Direct package versions are pinned in `package.json`; `package-lock.json` records the tested
dependency graph. Use Node 24 LTS; Node 22.12+ and Node 26+ are also allowed by the package engines.

| Component                             | Updated version     |
| ------------------------------------- | ------------------- |
| React / React DOM                     | 19.2.8              |
| TanStack Start / Router               | 1.168.49 / 1.170.32 |
| TanStack Query / Table                | 5.102.8 / 9.2.4     |
| Convex / Better Auth adapter          | 1.45.0 / 0.12.5     |
| Better Auth                           | 1.6.30              |
| Vite / React plugin                   | 8.2.2 / 6.1.1       |
| Tailwind CSS                          | 4.3.3               |
| TypeScript / ESLint                   | 6.0.3 / 10.10.0     |
| Vitest                                | 4.1.11              |
| Wrangler / Cloudflare Vite plugin     | 4.129.0 / 1.54.4    |
| Terraform in CI / Cloudflare provider | 1.16.1 / 5.24.0     |
| Clerk overlay                         | 1.5.12              |
| Nitro overlay (Vercel and Netlify)    | 3.0.260903-beta     |

## Compatibility decisions

- Better Auth stays below 1.7 because `@convex-dev/better-auth@0.12.5` declares that constraint.
- Vitest stays on 4 because Better Auth 1.6 declares support through Vitest 4.
- TypeScript stays on 6 because `typescript-eslint@8.69.0` supports TypeScript below 6.1.
- VitePress stays on the existing 2.0 alpha line, updated to alpha.20. Nitro remains an exact
  beta release. These prerelease dependencies are explicit exceptions to stable-release defaults.
- Netlify now uses Nitro's Netlify preset. The official Netlify development adapter's dependency
  tree contained unpatched audit findings; the Nitro path avoids that tooling.

Verify these constraints again before the next upgrade; do not use `--force` or
`--legacy-peer-deps` to bypass them.

## Code migrations

Vite 8 uses native `resolve.tsconfigPaths`; the extra path-resolution plugin and obsolete manual
chunk map were removed. Production minification keeps error logging. TanStack Table 9 explicitly
registers sorting and uses `useTable` and `table.FlexRender`. Worker types and routes are regenerated.

The auth helpers require verified email for allowlisted admin access. Error boundaries now catch
authentication and application-handler failures while preserving intentional `ConvexError`s.
Unexpected failures return an opaque error ID; details stay in server logs. Convex's own argument
and return-value validation remains outside these handler boundaries.

The setup scripts reject placeholder configurations, avoid overwriting existing settings without
confirmation, and redact secrets from dry-run output. Empty optional Sentry values are accepted.
The default setup offers Convex project initialization before asking for deployment URLs.

Local development permits HTTP/WebSocket connections to the configured loopback Convex backend.
HTTPS and production policies retain their existing connection restrictions. A fresh-app browser
check now exercises signup, session persistence, sign-in, chat, and file upload against a real
disposable local backend in CI.

## References

- [Vite migration guide](https://vite.dev/guide/migration)
- [Vitest migration guide](https://vitest.dev/guide/migration/)
- [Convex + Better Auth integration](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)
- [Nitro Netlify preset](https://nitro.build/deploy/providers/netlify)
- [Nitro Vercel preset](https://nitro.build/deploy/providers/vercel)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)

Sign-in controls are shared independently of the chat example. Generated chat-only projects omit
links to excluded file routes, and minimal projects retain a working sign-in entry point.
