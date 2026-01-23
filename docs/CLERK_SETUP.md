# Alternative Auth: Clerk Setup Guide

This guide shows how to replace Better Auth with Clerk for authentication.

## Why Clerk?

| Feature | Clerk | Better Auth |
|---------|-------|-------------|
| Pre-built UI | ✅ Polished components | ❌ Build your own |
| Pricing | Free tier, then $0.02/MAU | Free forever |
| Data ownership | Clerk hosts | You own (in Convex) |
| Setup complexity | Easier | More control |

## Step 1: Install Clerk

```bash
npm uninstall better-auth @convex-dev/better-auth
npm install @clerk/tanstack-react-start
```

## Step 2: Create Clerk Account

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Copy your API keys

## Step 3: Update Environment Variables

```bash
# .env.local

# Remove Better Auth vars
# - BETTER_AUTH_SECRET
# - GOOGLE_CLIENT_ID (Clerk handles OAuth)
# - GOOGLE_CLIENT_SECRET

# Add Clerk vars
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

## Step 4: Update Convex Auth Config

Replace `convex/auth.config.ts`:

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

## Step 5: Delete Better Auth Files

Remove these files:
- `convex/auth.ts`
- `convex/convex.config.ts`
- `src/lib/auth-client.ts`
- `src/lib/auth-server.ts`

Update `convex/http.ts` to remove Better Auth routes:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";

const http = httpRouter();

// No auth routes needed - Clerk handles this externally

export default http;
```

## Step 6: Update Router

Replace `src/router.tsx`:

```typescript
import { createRouter } from '@tanstack/react-router'
import { QueryClient, MutationCache } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { routeTree } from './routeTree.gen'
import { env } from './lib/env'

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    }),
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient },
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <ClerkProvider>
        <ConvexProviderWithClerk 
          client={convexQueryClient.convexClient}
          useAuth={useAuth}
        >
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    ),
  })

  return router
}
```

## Step 7: Update Components

Replace auth buttons with Clerk components:

```tsx
import { SignInButton, SignOutButton, UserButton, useUser } from '@clerk/tanstack-react-start'

function AuthButton() {
  const { isSignedIn } = useUser()

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <UserButton />
        <SignOutButton>Sign Out</SignOutButton>
      </div>
    )
  }

  return <SignInButton>Sign In</SignInButton>
}
```

## Step 8: Configure Clerk Dashboard

1. Go to Clerk Dashboard → JWT Templates
2. Create a new template named "convex"
3. Use this template:

```json
{
  "aud": "convex",
  "sub": "{{user.id}}"
}
```

4. Go to Sessions → Edit session token
5. Set the issuer domain to your Clerk domain

## Step 9: Update Convex Dashboard

1. Go to Convex Dashboard → Settings → Environment Variables
2. Add `CLERK_JWT_ISSUER_DOMAIN` with your Clerk issuer URL

## Resources

- [Convex + Clerk Documentation](https://docs.convex.dev/auth/clerk)
- [Clerk TanStack Start Guide](https://clerk.com/docs/references/tanstack-start)
- [TanStack Start + Clerk Template](https://github.com/get-convex/templates/tree/main/template-tanstack-start)
