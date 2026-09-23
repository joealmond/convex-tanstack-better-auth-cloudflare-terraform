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
3. Add the variables from `.env.example`; keep all non-`VITE_` secrets server-side.
4. Deploy from Git, or run:

```bash
npm run deploy
```

Nitro emits Netlify deployment configuration and server functions under `.netlify/`. Use a distinct `SITE_URL`
and auth callback/trusted-origin configuration for deploy previews and production.

See Netlify's current [TanStack Start guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/).

See the [Nitro Netlify preset](https://nitro.build/deploy/providers/netlify).
