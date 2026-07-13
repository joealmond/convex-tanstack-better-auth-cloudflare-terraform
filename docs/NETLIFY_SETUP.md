# Deploy to Netlify

Generate Netlify output directly:

```bash
npm create convexkit@latest my-app -- --deploy netlify
```

The generator installs Netlify's official TanStack Start Vite plugin, writes `netlify.toml`, removes
Cloudflare-only files, and adds narrow temporary overrides for audited transitive development
dependencies in the current adapter release.

## Deploy

1. Import the generated repository in Netlify.
2. Netlify reads `npm run build` and `dist/client` from `netlify.toml`.
3. Add the variables from `.env.example`; keep all non-`VITE_` secrets server-side.
4. Deploy from Git, or run:

```bash
npm run deploy
```

The plugin emits the SSR function at `.netlify/v1/functions/server.mjs`. Use a distinct `SITE_URL`
and auth callback/trusted-origin configuration for deploy previews and production.

See Netlify's current [TanStack Start guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/).
