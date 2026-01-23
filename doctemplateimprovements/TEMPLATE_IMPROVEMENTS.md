# Template Improvements & Lessons Learned

This document captures practical knowledge and common pitfalls discovered while working with this template. Use it to avoid common issues and understand the correct patterns.

---

## 🚨 Critical: TanStack Start API Patterns (v1.154+)

The TanStack Start API changed significantly. Here are the correct patterns:

### Client Entry Point (`src/start.tsx`)

```tsx
// ✅ CORRECT - Import from /client subpath
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
```

```tsx
// ❌ WRONG - Old API, no longer works
import { StartClient } from '@tanstack/react-start'  // Wrong path!
import { getRouter } from './router'

hydrateRoot(document, <StartClient router={getRouter()} />)  // router prop removed!
```

**IMPORTANT UPDATE (v1.154+):** TanStack Start now handles hydration automatically. You should **NOT** manually call `hydrateRoot`. The correct `start.tsx` is simply:

```tsx
// ✅ CORRECT - Let TanStack Start handle hydration
// TanStack Start v1.154+ handles hydration automatically.
// We only need to export startInstance for middleware/serialization.
// Do NOT manually call hydrateRoot - the framework does this.

export const startInstance = undefined
```

**Why:** Manually calling `hydrateRoot` causes "container already passed to createRoot" errors because TanStack Start's internal client entry also calls it.

**Key changes:**
- Import `StartClient` from `@tanstack/react-start/client` (not root)
- `StartClient` no longer takes a `router` prop - it handles router internally via `hydrateStart()`
- Use `startTransition` for React 19 concurrent hydration

### Server Entry Point (`src/server.ts`)

```typescript
// ✅ CORRECT - Use the default server-entry handler
import handler from '@tanstack/react-start/server-entry'

export default {
  fetch(request: Request) {
    return handler.fetch(request)
  },
}
```

```typescript
// ❌ WRONG - Old API pattern
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { getRouter } from './router'

export default createStartHandler({ getRouter })(defaultStreamHandler)  // getRouter no longer valid!
```

**Key changes:**
- Use `@tanstack/react-start/server-entry` default export
- Router is handled internally - don't pass `getRouter` callback
- The handler expects a standard fetch signature

### Custom Server Handlers (Advanced)

If you need to customize the server handler:

```typescript
import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const customHandler = defineHandlerCallback((ctx) => {
  // Add custom logic here (logging, observability, etc.)
  return defaultStreamHandler(ctx)
})

const fetch = createStartHandler(customHandler)

export default createServerEntry({ fetch })
```

---

## 🛣️ Route Tree Generation

The `routeTree.gen.ts` file is **auto-generated** and should not be manually created.

### How to Generate

```bash
# Option 1: Run dev server (generates on startup)
npm run dev

# Option 2: Use router CLI directly
npx @tanstack/router-cli generate
```

### TypeScript Errors Before Generation

If you see these errors, the route tree hasn't been generated yet:

```
Cannot find module './routeTree.gen'
Argument of type '"/login"' is not assignable to parameter of type 'undefined'
```

**Solution:** Run `npx @tanstack/router-cli generate` or start the dev server.

### .gitignore Consideration

Add to `.gitignore`:
```
src/routeTree.gen.ts
```

This file is regenerated on every dev/build, so it shouldn't be committed.

---

## 📊 Convex Schema: Better Auth User IDs

When using Better Auth with Convex, user IDs are **strings**, not Convex Id types.

### Schema Definition

```typescript
// ✅ CORRECT - Use v.string() for Better Auth user IDs
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  votes: defineTable({
    userId: v.optional(v.string()),  // Better Auth ID is a string!
    productId: v.id('products'),      // Convex IDs use v.id()
    safety: v.number(),
    taste: v.number(),
  }),
  
  profiles: defineTable({
    userId: v.string(),  // String, not v.id('users')!
    points: v.number(),
    badges: v.array(v.string()),
  }),
})
```

```typescript
// ❌ WRONG - v.id('users') doesn't exist with Better Auth
votes: defineTable({
  userId: v.optional(v.id('users')),  // Will cause type errors!
})
```

**Why:** Better Auth manages its own user table, and the `user._id` is a string UUID, not a Convex document ID.

---

## 🔧 Wrangler Configuration (`wrangler.jsonc`)

### nodejs_compat Flag

Use `nodejs_compat_v2` instead of `nodejs_compat` to avoid duplicate flag errors:

```jsonc
// ✅ CORRECT
{
  "compatibility_flags": ["nodejs_compat_v2"]
}
```

```jsonc
// ❌ WRONG - Causes "nodejs_compat specified multiple times" error
{
  "compatibility_flags": ["nodejs_compat"]
}
```

**Why:** The Cloudflare Vite plugin automatically adds `nodejs_compat`, so specifying it manually causes a duplicate. Using `nodejs_compat_v2` avoids this conflict while still enabling Node.js compatibility.

---

## ☁️ Cloudflare Vite Plugin Configuration

The `@cloudflare/vite-plugin` (v1.x) has specific configuration requirements.

### Valid Configuration

```typescript
// ✅ CORRECT - Simple configuration, no config callback needed
import { cloudflare } from '@cloudflare/vite-plugin'

cloudflare({
  viteEnvironment: { name: 'ssr' },
  configPath: './wrangler.jsonc',
})
```

```typescript
// ❌ WRONG - config callback causes issues with TanStack Start
cloudflare({
  viteEnvironment: { name: 'ssr' },
  configPath: './wrangler.jsonc',
  config: (config) => ({
    ...config,
    env: 'preview',
  }),
})
```

```typescript
// ❌ WRONG - 'environment' is not a valid top-level property
cloudflare({
  viteEnvironment: { name: 'ssr' },
  configPath: './wrangler.jsonc',
  environment: 'preview',  // TypeScript error!
})
```

### Valid Plugin Config Properties

| Property | Type | Description |
|----------|------|-------------|
| `viteEnvironment` | `{ name?: string }` | Vite environment name |
| `configPath` | `string` | Path to wrangler config |
| `auxiliaryWorkers` | `array` | Additional worker configs |
| `persistState` | `boolean \| { path: string }` | Persist state between runs |
| `inspectorPort` | `number \| false` | DevTools inspector port |
| `remoteBindings` | `boolean` | Use remote bindings |
| `experimental` | `object` | Experimental features |
| `config` | `function` | Config customization |

---

## 🎯 TypeScript Best Practices

### Avoid `any` - Use `unknown` with Type Guards

```typescript
// ✅ CORRECT
try {
  await someAsyncOperation()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  toast.error(message)
}

// ❌ WRONG - Triggers eslint errors
try {
  await someAsyncOperation()
} catch (error: any) {
  toast.error(error.message)  // Unsafe!
}
```

### React Component Children Type

```tsx
// ✅ CORRECT - Import ReactNode for children
import { type ReactNode } from 'react'

function Wrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

// ❌ WRONG - Implicit any
function Wrapper({ children }) {  // Type error!
  return <div>{children}</div>
}
```

### Nested Object Traversal

When traversing nested objects with string keys:

```typescript
// ✅ CORRECT - Explicit type annotations
interface Translations {
  [key: string]: string | Translations
}

function getNestedValue(obj: Translations, path: string): string {
  const keys = path.split('.')
  let current: Translations | string = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      const value: Translations | string | undefined = current[key]
      if (value !== undefined) {
        current = value
      } else {
        return path
      }
    } else {
      return path
    }
  }

  return typeof current === 'string' ? current : path
}
```

---

## 🪝 Custom Hooks: Consistent Return Types

Hooks should return objects with clear property names, not direct values.

### Good Hook Design

```typescript
// ✅ CORRECT - Returns object with named properties
export function useAnonymousId() {
  const [anonId, setAnonId] = useState<string | null>(null)
  
  useEffect(() => {
    // ... initialization logic
  }, [])
  
  return { anonId, setAnonId, isLoading: anonId === null }
}

// Usage
const { anonId } = useAnonymousId()
```

```typescript
// ⚠️ INCONSISTENT - Causes destructuring issues
export function useAnonymousId() {
  const [id] = useState(generateId())
  return id  // Returns string directly
}

// Then later changing to:
export function useAnonymousId() {
  return { anonId: '...' }  // Breaks existing usages!
}
```

### Check Hook Return Types Before Use

When you see destructuring errors like:
```
Property 'anonId' does not exist on type 'string'
```

Check the hook implementation - the return type may have changed.

---

## � SSR & Authentication: Preventing Hydration Mismatches

When using Convex + Better Auth with SSR (TanStack Start), authentication-dependent components cause hydration mismatches because the server renders without auth state, but the client renders with it.

### The Problem

```tsx
// ❌ CAUSES HYDRATION MISMATCH
function Navigation() {
  const { data: user } = useQuery(convexQuery(api.users.current, {}))
  
  return (
    <nav>
      {user ? <UserMenu user={user} /> : <SignInButton />}
    </nav>
  )
}
```

The server renders `<SignInButton />` (unauthenticated), but the client might render `<UserMenu />` (authenticated), causing a mismatch.

### Solution 1: Use `<ClientOnly>` Wrapper

```tsx
// ✅ CORRECT - Wrap auth-dependent UI in ClientOnly
import { ClientOnly } from '@tanstack/react-start'

function Navigation() {
  return (
    <nav>
      <ClientOnly fallback={<AuthLoadingFallback />}>
        {() => <AuthSection />}
      </ClientOnly>
    </nav>
  )
}

function AuthSection() {
  const { data: user } = useQuery(convexQuery(api.users.current, {}))
  return user ? <UserMenu user={user} /> : <SignInButton />
}

function AuthLoadingFallback() {
  return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
}
```

### Solution 2: Safe Convex Queries for SSR

Wrap `authComponent.getAuthUser()` in try-catch to return `null` instead of throwing during SSR:

```typescript
// convex/users.ts
import { query, type QueryCtx } from './_generated/server'
import { authComponent } from './auth'

// Safe wrapper that returns null instead of throwing
async function getAuthUserSafe(ctx: QueryCtx): Promise<AuthUser | null> {
  try {
    return (await authComponent.getAuthUser(ctx)) as AuthUser | null
  } catch {
    // Unauthenticated during SSR - return null
    return null
  }
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserSafe(ctx)  // Won't throw during SSR
  },
})

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx)
    if (!user) return false
    // ... admin check logic
  },
})
```

### Components That Need ClientOnly

- Authentication buttons (sign in/out)
- User avatars and menus
- Admin toolbars
- Any component that uses `useQuery(api.users.current)` or `useQuery(api.users.isAdmin)`
- Side effects that depend on auth state (migrations, etc.)

---

## 🔄 Router Configuration for SSR

### QueryClientProvider in Router

Ensure `QueryClientProvider` is included in the router's `Wrap` component:

```tsx
// src/router.tsx
import { QueryClientProvider } from '@tanstack/react-query'

export const createRouter = () =>
  createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <div>
        <p>Page not found</p>
        <Link to="/">Go home</Link>
      </div>
    ),
    Wrap: ({ children }) => (
      <ConvexProvider client={convexClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ConvexProvider>
    ),
  })
```

**Why:** Without `QueryClientProvider` in `Wrap`, you get "No QueryClient set" errors during SSR.

---

## 📦 i18n: Static Imports Only

Vite cannot analyze dynamic imports. Use static imports with conditionals:

```typescript
// ✅ CORRECT - Static imports
import en from './locales/en.json'
import hu from './locales/hu.json'

const translations: Record<string, TranslationFile> = { en, hu }

export function getTranslation(lang: string, key: string): string {
  const file = translations[lang] || translations['en']
  return file[key] || key
}
```

```typescript
// ❌ WRONG - Dynamic imports cause warnings
export async function getTranslation(lang: string) {
  const file = await import(`./locales/${lang}.json`)  // Vite warning!
  return file.default
}
```

---

## 🚀 dev.sh Script: Environment Loading

Use `source` instead of `export $(xargs)` for loading environment files:

```bash
# ✅ CORRECT
if [ -f ".env.local" ]; then
  set -a
  source .env.local
  set +a
fi
```

```bash
# ❌ WRONG - Fails with comments and special characters
export $(grep -v '^#' .env.local | xargs)
```

---

## �📋 Schema Field Naming Conventions

Use consistent field names across schema and code:

| Schema Field | ✅ Correct | ❌ Avoid |
|--------------|-----------|----------|
| Average safety score | `averageSafety` | `avgSafety`, `safety_avg` |
| Average taste score | `averageTaste` | `avgTaste`, `taste_avg` |
| Vote count | `voteCount` | `numVotes`, `vote_count` |
| Store name | `storeName` | `storeTag`, `store` |
| Streak count | `streak` | `currentStreak`, `streakDays` |

**Why:** Inconsistent naming causes type mismatches between frontend and backend that are hard to debug.

---

## 🔧 Development Workflow

### First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Start Convex dev server (generates types)
npx convex dev

# 3. In another terminal, generate route tree
npx @tanstack/router-cli generate

# 4. Start Vite dev server
npm run dev
```

### After Pulling Changes

```bash
# Regenerate all generated files
npx convex dev --once           # Regenerate Convex types
npx @tanstack/router-cli generate  # Regenerate route tree
npm run typecheck                # Verify no type errors
```

### Pre-Commit Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] No `any` types in code
- [ ] Route tree is up-to-date
- [ ] Convex functions deployed

---

## 📚 Documentation to Read

When working with this template, familiarize yourself with:

| Topic | Documentation |
|-------|---------------|
| TanStack Start | https://tanstack.com/start/latest/docs |
| TanStack Router File-Based Routing | https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing |
| Convex Schema | https://docs.convex.dev/database/schemas |
| Better Auth | https://www.better-auth.com/docs |
| Cloudflare Vite Plugin | https://developers.cloudflare.com/workers/frameworks/framework-guides/vite |

---

## ⚠️ Common Gotchas

### 1. Convex Function File Names
No hyphens allowed! Use underscores or camelCase:
```
✅ my_function.ts, myFunction.ts
❌ my-function.ts (breaks Convex)
```

### 2. Query vs Mutation for Profile Creation
Don't create profiles inside queries (side effects not allowed):
```typescript
// ✅ CORRECT - Separate query and mutation
export const getCurrent = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    return await ctx.db.query('profiles').withIndex('by_userId', q => 
      q.eq('userId', user._id)
    ).first()
  },
})

export const ensureProfile = mutation({
  handler: async (ctx) => {
    const user = await requireAuth(ctx)
    // Create profile if doesn't exist
  },
})
```

### 3. TanStack Start v1.154+ - Don't Manually Hydrate
Let TanStack Start handle hydration. Your `start.tsx` should only export `startInstance`:
```tsx
// ✅ CORRECT - Just export startInstance
export const startInstance = undefined

// ❌ WRONG - Causes "container already passed to createRoot" error
import { hydrateRoot } from 'react-dom/client'
hydrateRoot(document, <StrictMode><StartClient /></StrictMode>)
```

### 4. Optional Chaining for API Responses
Always use optional chaining when accessing Convex query results:
```tsx
// ✅ CORRECT
const votes = useQuery(api.votes.list)
const count = votes?.length ?? 0

// ❌ WRONG - Will crash if votes is undefined
const count = votes.length
```

### 5. Auth Components Need ClientOnly
Wrap authentication-dependent components in `<ClientOnly>` to prevent SSR hydration mismatches:
```tsx
// ✅ CORRECT
<ClientOnly fallback={<Skeleton />}>
  {() => <UserMenu />}
</ClientOnly>

// ❌ WRONG - Hydration mismatch
<UserMenu />  // Renders differently on server vs client
```

### 6. Wrangler nodejs_compat Duplicate
Use `nodejs_compat_v2` in wrangler.jsonc to avoid "nodejs_compat specified multiple times" error:
```jsonc
// ✅ CORRECT
{ "compatibility_flags": ["nodejs_compat_v2"] }

// ❌ WRONG - Cloudflare plugin also adds this
{ "compatibility_flags": ["nodejs_compat"] }
```

### 7. Better Auth getAuthUser Throws on SSR
Wrap `authComponent.getAuthUser()` in try-catch for queries used during SSR:
```typescript
// ✅ CORRECT - Return null instead of throwing
async function getAuthUserSafe(ctx: QueryCtx) {
  try {
    return await authComponent.getAuthUser(ctx)
  } catch {
    return null
  }
}
```

---

## 🔄 Migration Notes

### From v1.x to v1.154+ TanStack Start

1. **Update `src/start.tsx`:**
   - Remove ALL hydration code
   - Just export `startInstance = undefined`
   - TanStack Start handles hydration automatically

2. **Update `src/server.ts`:**
   - Change to `import handler from '@tanstack/react-start/server-entry'`
   - Use `handler.fetch(request)` pattern

3. **Update `wrangler.jsonc`:**
   - Change `nodejs_compat` to `nodejs_compat_v2`

4. **Update `vite.config.ts`:**
   - Remove `config` callback from cloudflare plugin
   - Keep it simple: `cloudflare({ viteEnvironment: { name: 'ssr' } })`

5. **Update `src/router.tsx`:**
   - Add `QueryClientProvider` to the `Wrap` component
   - Add `defaultNotFoundComponent` to router config

6. **Fix auth-dependent components:**
   - Wrap in `<ClientOnly>` to prevent hydration mismatches
   - Create safe wrappers for Convex auth queries

7. **Regenerate route tree:**
   ```bash
   npx @tanstack/router-cli generate
   ```

---

*Last updated: January 2026*
*Based on: TanStack Start v1.154.12, Convex v1.31.6, @cloudflare/vite-plugin v1.21.2, React 19*
