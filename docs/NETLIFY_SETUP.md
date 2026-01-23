# Alternative Deploy: Netlify Setup Guide

This guide shows how to deploy to Netlify instead of Cloudflare Workers.

## Why Netlify?

| Feature | Netlify | Cloudflare Workers |
|---------|---------|-------------------|
| DX | Very easy | Needs wrangler |
| Pricing | Good free tier | Cheaper at scale |
| Functions | Netlify Functions | Native Workers |
| Forms | Built-in | Manual |

## Step 1: Install Netlify Plugin

```bash
# Remove Cloudflare plugin
npm uninstall @cloudflare/vite-plugin wrangler

# Install Netlify plugin
npm install @netlify/vite-plugin-tanstack-start
```

## Step 2: Update vite.config.ts

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlifyPlugin from '@netlify/vite-plugin-tanstack-start'

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
      netlifyPlugin(),
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

## Step 3: Create netlify.toml

```toml
[build]
  command = "npm run build:prod"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
```

## Step 4: Update package.json Scripts

```json
{
  "scripts": {
    "build:prod": "VITE_APP_ENV=production vite build",
    "build:preview": "VITE_APP_ENV=preview vite build",
    "netlify:dev": "netlify dev",
    "netlify:deploy": "npm run build:prod && netlify deploy --prod"
  }
}
```

## Step 5: Remove Cloudflare Files

Delete these files:
- `wrangler.jsonc`

## Step 6: Set Up Netlify Project

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize project
netlify init

# Get site ID for GitHub Actions
netlify status
```

## Step 7: Configure GitHub Actions

Set these repository variables:
- `DEPLOY_TARGET` = `netlify`

Set these repository secrets:
| Secret | Description |
|--------|-------------|
| `NETLIFY_AUTH_TOKEN` | From Netlify User Settings → OAuth |
| `NETLIFY_SITE_ID` | From `netlify status` or dashboard |

## Step 8: Set Environment Variables in Netlify

Go to Netlify Dashboard → Site → Site configuration → Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_CONVEX_URL` | Your Convex URL |
| `VITE_CONVEX_SITE_URL` | Your Convex Site URL |
| `BETTER_AUTH_SECRET` | Your auth secret |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `SITE_URL` | Your Netlify deployment URL |

## Step 9: Deploy

```bash
# Manual deploy
netlify deploy --prod

# Or push to main for automatic deployment
git push origin main
```

## Local Development with Netlify

```bash
# Run with Netlify dev server (simulates Netlify Functions)
netlify dev
```

## Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify TanStack Start Plugin](https://www.npmjs.com/package/@netlify/vite-plugin-tanstack-start)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
