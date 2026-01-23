# Pattern Improvements

Better patterns and practices discovered while building with the template.

---

## 1. Convex Query with React Query Integration

### Current Pattern (Template)
The template uses basic Convex integration without demonstrating advanced patterns.

### Improved Pattern (From g-convex)
Use `@convex-dev/react-query` for better caching and state management:

```typescript
// src/lib/convex.ts
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
const convexQueryClient = new ConvexQueryClient(convex)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
})
convexQueryClient.connect(queryClient)

export { convex, queryClient }
```

### Benefits
- Unified caching strategy
- Better devtools integration
- Consistent data fetching patterns

---

## 2. Environment Validation with Zod

### Current Pattern (Template)
Basic `import.meta.env.VITE_*` access without validation.

### Improved Pattern
Validate all environment variables at startup:

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_CONVEX_URL: z.string().url(),
  VITE_CONVEX_SITE_URL: z.string().url(),
})

// Server-side schema
const serverEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SITE_URL: z.string().url(),
  GOOGLE_API_KEY: z.string().optional(),
})

// Validate at module load
export const env = envSchema.parse(import.meta.env)

// For server functions
export function getServerEnv() {
  return serverEnvSchema.parse(process.env)
}
```

### Benefits
- Fail fast on missing config
- Type-safe environment access
- Clear error messages

---

## 3. Admin Check with Impersonation Support

### Current Pattern (Template)
Simple `isAdmin` check without impersonation.

### Improved Pattern
Support "View as User" for testing:

```typescript
// src/hooks/use-admin.ts
import { useImpersonate } from './use-impersonate'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'

export function useAdmin() {
  const { isImpersonating } = useImpersonate()
  const { data: isActualAdmin } = useQuery(
    convexQuery(api.users.isAdmin, {})
  )

  // When impersonating, pretend we're not admin
  const isAdmin = isImpersonating ? false : isActualAdmin

  return { isAdmin, isActualAdmin, isImpersonating }
}
```

```typescript
// src/hooks/use-impersonate.tsx
import { createContext, useContext, useState, ReactNode } from 'react'

interface ImpersonateContext {
  isImpersonating: boolean
  toggleImpersonate: () => void
}

const ImpersonateContext = createContext<ImpersonateContext | null>(null)

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const [isImpersonating, setIsImpersonating] = useState(false)

  return (
    <ImpersonateContext.Provider
      value={{
        isImpersonating,
        toggleImpersonate: () => setIsImpersonating(prev => !prev)
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  )
}

export function useImpersonate() {
  const context = useContext(ImpersonateContext)
  if (!context) throw new Error('useImpersonate must be used within ImpersonateProvider')
  return context
}
```

### Benefits
- Admins can test user experience
- Easier debugging
- Better QA process

---

## 4. Anonymous User ID Management

### Current Pattern (Template)
No support for anonymous users.

### Improved Pattern
Generate and persist anonymous IDs:

```typescript
// src/hooks/use-anonymous-id.ts
import { useState, useEffect } from 'react'

const ANON_ID_KEY = 'anonymous_user_id'

function generateAnonId(): string {
  return `anon_${crypto.randomUUID()}`
}

export function useAnonymousId() {
  const [anonId, setAnonId] = useState<string | null>(null)

  useEffect(() => {
    let id = localStorage.getItem(ANON_ID_KEY)
    if (!id) {
      id = generateAnonId()
      localStorage.setItem(ANON_ID_KEY, id)
    }
    setAnonId(id)
  }, [])

  const clearAnonId = () => {
    localStorage.removeItem(ANON_ID_KEY)
    setAnonId(null)
  }

  return { anonId, clearAnonId }
}
```

### Use Case
Allow voting before sign-up, then migrate votes:

```typescript
// convex/votes.ts
export const migrateAnonymousVotes = mutation({
  args: { anonymousId: v.string() },
  handler: async (ctx, { anonymousId }) => {
    const user = await requireAuth(ctx)
    
    // Find all anonymous votes
    const anonVotes = await ctx.db
      .query('votes')
      .withIndex('by_anonymous_id', q => q.eq('anonymousId', anonymousId))
      .collect()

    // Update to registered user
    for (const vote of anonVotes) {
      await ctx.db.patch(vote._id, {
        userId: user._id,
        anonymousId: undefined,
        isAnonymous: false
      })
    }
  }
})
```

---

## 5. Weighted Average Calculations

### Current Pattern (Template)
No aggregation examples.

### Improved Pattern
Calculate weighted averages for ratings:

```typescript
// convex/lib/config.ts
export const VOTE_WEIGHTS = {
  REGISTERED: 2,  // Registered users have 2x weight
  ANONYMOUS: 1,   // Anonymous users have 1x weight
}

// convex/products.ts
export const recalculateAverages = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, { productId }) => {
    const votes = await ctx.db
      .query('votes')
      .withIndex('by_product', q => q.eq('productId', productId))
      .collect()

    let totalWeight = 0
    let weightedSafetySum = 0
    let weightedTasteSum = 0

    for (const vote of votes) {
      const weight = vote.isAnonymous 
        ? VOTE_WEIGHTS.ANONYMOUS 
        : VOTE_WEIGHTS.REGISTERED

      totalWeight += weight
      weightedSafetySum += vote.safety * weight
      weightedTasteSum += vote.taste * weight
    }

    if (totalWeight > 0) {
      await ctx.db.patch(productId, {
        avgSafety: weightedSafetySum / totalWeight,
        avgTaste: weightedTasteSum / totalWeight,
        totalVotes: votes.length,
        lastUpdated: Date.now(),
      })
    }
  }
})
```

---

## 6. Rate Limiting Pattern

### Current Pattern (Template)
No rate limiting.

### Improved Pattern
Use Convex rate limiter component:

```typescript
// convex/convex.config.ts
import { defineComponent } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'

export default defineComponent('app', {
  rateLimiter
})

// convex/lib/rateLimits.ts
import { rateLimiter } from './components'

export const voteLimiter = rateLimiter.define({
  name: 'vote',
  config: {
    kind: 'token bucket',
    rate: 10,      // 10 votes
    period: 60000, // per minute
    capacity: 15,  // burst capacity
  }
})

// convex/votes.ts
export const castVote = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const userId = (await getUser(ctx))?._id ?? args.anonymousId
    
    // Check rate limit
    const { ok, retryAfter } = await voteLimiter.check(ctx, { 
      key: userId 
    })
    
    if (!ok) {
      throw new Error(`Rate limited. Retry after ${retryAfter}ms`)
    }

    // Proceed with vote
    await voteLimiter.consume(ctx, { key: userId })
    // ... insert vote
  }
})
```

---

## 7. Geolocation Hook Pattern

### Current Pattern (Template)
No location features.

### Improved Pattern
Clean geolocation hook:

```typescript
// src/hooks/use-geolocation.tsx
import { useState, useEffect, useCallback } from 'react'

interface GeoState {
  loading: boolean
  error: string | null
  coords: { latitude: number; longitude: number } | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    loading: false,
    error: null,
    coords: null,
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported' }))
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          error: null,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        })
      },
      (error) => {
        setState({
          loading: false,
          error: error.message,
          coords: null,
        })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { ...state, requestLocation }
}
```

---

## 8. Consistent Error Handling

### Current Pattern (Template)
Basic ErrorBoundary only.

### Improved Pattern
Layered error handling:

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_REQUIRED', 401)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}ms`, 'RATE_LIMITED', 429)
  }
}

// Usage in mutations
export const doSomething = mutation({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity()
    if (!user) {
      throw new AuthError()
    }
    // ...
  }
})
```

---

## 9. File Organization Pattern

### Current Pattern (Template)
Flat structure in `src/`.

### Improved Pattern
Feature-based organization:

```
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Layout components (header, footer, nav)
│   └── features/     # Feature-specific components
│       ├── products/
│       ├── voting/
│       └── profile/
├── hooks/
│   ├── auth/         # Auth-related hooks
│   ├── data/         # Data fetching hooks
│   └── ui/           # UI utility hooks
├── lib/
│   ├── auth/         # Auth utilities
│   ├── api/          # API helpers
│   └── utils/        # General utilities
└── routes/
    ├── _authenticated/  # Protected routes
    └── api/             # API routes
```

---

## 10. Type Export Pattern

### Current Pattern (Template)
Types scattered across files.

### Improved Pattern
Centralized type exports:

```typescript
// src/lib/types.ts
import type { Id, Doc } from '@convex/_generated/dataModel'

// Re-export Convex types
export type { Id, Doc }

// Domain types
export interface User {
  id: Id<'user'>
  name: string
  email: string
  isAdmin: boolean
}

export interface Product {
  id: Id<'products'>
  name: string
  avgSafety: number
  avgTaste: number
}

export interface Vote {
  id: Id<'votes'>
  productId: Id<'products'>
  safety: number
  taste: number
  userId?: Id<'user'>
  anonymousId?: string
}

// API response types
export interface ApiResponse<T> {
  data: T
  error?: string
}
```

---

## Summary

These patterns represent battle-tested solutions from building a real production application. Incorporating them into the template would significantly improve developer experience and code quality.
