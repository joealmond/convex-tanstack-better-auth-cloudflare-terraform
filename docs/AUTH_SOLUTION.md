# 🔐 Auth Integration Solution

## Stack
- **Convex** (^1.31.7) - Backend with real-time data sync
- **Better Auth** (1.4.9) - Authentication library with OAuth providers
- **@convex-dev/better-auth** (^0.10.10) - Convex component for Better Auth
- **TanStack Start** (v1.159.0) - Full-stack React framework with SSR
- **Cloudflare Workers** - Edge deployment

## Problem
CORS errors occurred when auth requests tried to hit `*.convex.site` directly from the client:
```
Access to fetch at 'https://your-deployment.convex.site/better-auth-api/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Solution
Follow the **official Convex Better Auth TanStack Start pattern**:

**Reference**: https://labs.convex.dev/better-auth/framework-guides/tanstack-start

### Key Changes

#### 1. API Proxy Route (`src/routes/api/auth/$.ts`)
Create a catch-all route that proxies auth requests to Convex:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { handler } from '@/lib/auth-server'

export const Route = createFileRoute('/api/auth/$')({
  GET: ({ request }) => handler(request),
  POST: ({ request }) => handler(request),
})
```

#### 2. Auth Client (`src/lib/auth-client.ts`)
Remove `baseURL` - let the `convexClient()` plugin handle routing:
```typescript
import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

export const authClient = createAuthClient({
  // NO baseURL - plugin handles routing to /api/auth/*
  plugins: [convexClient()],
})
```

#### 3. Auth Server (`src/lib/auth-server.ts`)
Use `import.meta.env` instead of `process.env` (Cloudflare Workers SSR context):
```typescript
import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: (import.meta as any).env.VITE_CONVEX_URL!,
  convexSiteUrl: (import.meta as any).env.VITE_CONVEX_SITE_URL!,
})
```

#### 4. Router (`src/router.tsx`)
- Add `expectAuth: true` to `ConvexQueryClient`
- Use `setupRouterSsrQueryIntegration` for SSR
- Remove `ConvexBetterAuthProvider` from Wrap (moved to root route)
- Pass `convexQueryClient` in context

```typescript
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

const convexQueryClient = new ConvexQueryClient(convexUrl, {
  expectAuth: true, // Important for SSR auth
})

const router = createRouter({
  routeTree,
  context: { queryClient, convexQueryClient }, // Pass both
  // No Wrap component
})

setupRouterSsrQueryIntegration({ router, queryClient })
```

#### 5. Root Route (`src/routes/__root.tsx`)
- Add `ConvexBetterAuthProvider` with `initialToken` from SSR
- Implement `beforeLoad` that calls `getToken()` for SSR auth
- Set auth on `convexQueryClient.serverHttpClient` during SSR

```typescript
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { createServerFn } from '@tanstack/react-start'
import { getToken } from '@/lib/auth-server'

const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async (ctx) => {
    const token = await getAuth()
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }
    return { isAuthenticated: !!token, token }
  },
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })
  
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      {/* app content */}
    </ConvexBetterAuthProvider>
  )
}
```

## Why This Works

1. **No CORS**: Auth requests go to same origin `/api/auth/*` (no cross-origin)
2. **Server-side proxy**: API route forwards requests to Convex site URL
3. **SSR auth**: Server gets token via `getToken()` and sets it on `convexQueryClient`
4. **Hydration**: `initialToken` passed to client prevents auth flash
5. **Environment variables**: `import.meta.env` works in Cloudflare Workers SSR context (process.env doesn't)

## Required Environment Variables

Create `.env.local`:
```bash
# Get these from: npx convex dev
CONVEX_DEPLOYMENT=dev:your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site

# Your app URL
SITE_URL=http://localhost:3000

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret

# Generate with: npx @better-auth/cli generate-secret
BETTER_AUTH_SECRET=your-generated-secret
```

Set in Convex:
```bash
npx convex env set SITE_URL "http://localhost:3000"
npx convex env set GOOGLE_CLIENT_ID "your-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "GOCSPX-your-secret"
npx convex env set BETTER_AUTH_SECRET "your-generated-secret"
```

## Dependencies
```bash
npm install @tanstack/react-router-ssr-query
```

## References

- **Official Docs**: https://labs.convex.dev/better-auth/framework-guides/tanstack-start
- **Better Auth Docs**: https://www.better-auth.com/docs
- **Convex Better Auth Component**: https://labs.convex.dev/better-auth
- **Reference Projects**: Similar stack implementations for comparison

## Testing

1. Start dev servers:
```bash
npx convex dev  # Terminal 1
npm run dev     # Terminal 2
```

2. Visit `http://localhost:3000`
3. Click "Sign in with Google"
4. Should redirect to Google OAuth consent
5. After consent, should redirect back authenticated
6. No CORS errors in console
7. SSR should work (view page source shows auth state)

## Common Issues

### "CONVEX_SITE_URL is not set"
- Make sure using `import.meta.env` in `auth-server.ts`, not `process.env`
- Verify `.env.local` has `VITE_CONVEX_SITE_URL` set

### Auth not persisting across page reloads
- Check `initialToken` is passed to `ConvexBetterAuthProvider`
- Verify `beforeLoad` is setting auth on `convexQueryClient.serverHttpClient`

### CORS errors persist
- Ensure auth-client.ts has NO `baseURL` property
- Verify API route exists at `src/routes/api/auth/$.ts`
- Check `convexClient()` plugin is registered
