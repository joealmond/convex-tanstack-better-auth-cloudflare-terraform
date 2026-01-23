# Alternative Deploy: Vercel Setup Guide

This guide shows how to deploy to Vercel instead of Cloudflare Workers.

## Why Vercel?

| Feature | Vercel | Cloudflare Workers |
|---------|--------|-------------------|
| DX | Excellent, zero-config | Good, needs wrangler |
| Pricing | Generous free tier | Very cheap at scale |
| Edge Runtime | Edge Functions | Native Workers |
| Ecosystem | Large | Growing |

## Step 1: Install Vercel Adapter

```bash
# Remove Cloudflare plugin
npm uninstall @cloudflare/vite-plugin wrangler

# Install Vercel adapter (if available for TanStack Start)
# Note: TanStack Start has built-in Vercel support
```

## Step 2: Update vite.config.ts

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart({
        srcDirectory: 'src',
        start: { entry: './start.tsx' },
        server: { entry: './server.ts' },
      }),
      tailwindcss(),
      viteReact(),
    ],
    ssr: {
      noExternal: ['@convex-dev/better-auth'],
    },
    server: {
      port: 3000,
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
    },
  }
})
```

## Step 3: Create vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "npm run build:prod",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "devCommand": "npm run dev"
}
```

## Step 4: Update package.json Scripts

```json
{
  "scripts": {
    "build:prod": "VITE_APP_ENV=production vite build",
    "build:preview": "VITE_APP_ENV=preview vite build"
  }
}
```

## Step 5: Remove Cloudflare Files

Delete these files:
- `wrangler.jsonc`
- Any Cloudflare-specific bindings

## Step 6: Set Up Vercel Project

```bash
# Install Vercel CLI
npm install -g vercel

# Link to Vercel
vercel link

# Get project IDs for GitHub Actions
vercel project ls
```

## Step 7: Configure GitHub Actions

Set these repository variables:
- `DEPLOY_TARGET` = `vercel`

Set these repository secrets:
| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | From Vercel Settings → Tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` |

## Step 8: Set Environment Variables in Vercel

Go to Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_CONVEX_URL` | Your Convex URL |
| `VITE_CONVEX_SITE_URL` | Your Convex Site URL |
| `BETTER_AUTH_SECRET` | Your auth secret |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `SITE_URL` | Your Vercel deployment URL |

## Step 9: Deploy

```bash
# Manual deploy
vercel deploy --prod

# Or push to main for automatic deployment
git push origin main
```

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [TanStack Start Deployment](https://tanstack.com/start/latest/docs/hosting)
