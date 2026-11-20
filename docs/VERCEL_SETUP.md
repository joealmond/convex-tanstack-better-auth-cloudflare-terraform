# Deploy to Vercel

Generate Vercel output directly:

```bash
npm create convexkit@latest my-app -- --deploy vercel
```

The generator removes Cloudflare-only files, installs Nitro, adds `nitro()` to Vite, writes
`vercel.json`, and provides `npm run deploy`.

## Deploy

1. Push the generated project to GitHub, GitLab, or Bitbucket.
2. Import it in Vercel and confirm the framework preset is **TanStack Start**.
3. Add `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, and enabled `VITE_*` feature flags to the matching Vercel Preview or Production environment. These are browser/build values; never expose a secret with a `VITE_` prefix.
4. Deploy from Git, or run:

```bash
npx vercel
npx vercel --prod
```

Vercel detects Nitro and emits server functions. `SITE_URL`, `BETTER_AUTH_SECRET`, account-email settings,
and provider API keys are Convex backend values, not Vercel environment variables. Set them on the matching
Convex deployment:

```bash
# Stable preview origin, using the selected development Convex deployment
CONVEX_DEPLOYMENT=dev:your-preview npx convex env set SITE_URL https://preview.example.com

# Production Convex deployment
npx convex env set --prod SITE_URL https://app.example.com
```

Use the same exact public URL in auth redirect and trusted-origin settings. Vercel's changing deploy-preview
URLs need a stable preview domain for account email and redirect-based auth.

See Vercel's current [TanStack Start deployment guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel).
