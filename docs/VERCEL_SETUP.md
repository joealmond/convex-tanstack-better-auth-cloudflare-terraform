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
3. Add the variables from `.env.example`; never expose server secrets with a `VITE_` prefix.
4. Deploy from Git, or run:

```bash
npx vercel
npx vercel --prod
```

Vercel detects Nitro and emits server functions. Preview deployments receive distinct URLs, so set
`SITE_URL` and auth redirect/trusted-origin configuration for the relevant environment.

See Vercel's current [TanStack Start deployment guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel).
