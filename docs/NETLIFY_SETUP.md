# Deploy to Netlify

Generate Netlify output directly:

```bash
npm create convexkit@latest my-app -- --deploy netlify
```

The generator uses the pinned Nitro adapter with an explicit `netlify` preset and writes
`netlify.toml`. The Netlify development plugin was removed because its transitive image and TOML
dependencies did not pass the dependency audit. No dependency overrides are needed for Nitro.

## Deploy

1. Import the generated repository in Netlify.
2. Netlify reads `npm run build` and `dist` from `netlify.toml`.
3. In Netlify, add only browser/build values such as `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, and enabled `VITE_*` feature flags. Set preview and production values in their matching Netlify contexts.
4. Deploy from Git, or run:

```bash
npm run deploy
```

Nitro emits Netlify deployment configuration and server functions under `.netlify/`; the build checks both
that directory and `dist` for copied secrets. `SITE_URL`, `BETTER_AUTH_SECRET`, account-email settings, and
provider API keys belong to the selected Convex deployment, never the Netlify build environment.

For a stable preview domain, target its Convex development deployment explicitly:

```bash
CONVEX_DEPLOYMENT=dev:your-preview npx convex env set SITE_URL https://preview.example.com
```

For production, target the production Convex deployment explicitly:

```bash
npx convex env set --prod SITE_URL https://app.example.com
```

Set the same exact public URL in the matching provider callback settings. A dynamic deploy-preview URL cannot
be the long-lived backend `SITE_URL`; use a stable preview domain or keep account email disabled for that preview.

See Netlify's current [TanStack Start guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/).

See the [Nitro Netlify preset](https://nitro.build/deploy/providers/netlify).
