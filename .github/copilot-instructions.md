# Convex + TanStack Start + Cloudflare Workers

This template provides a modern, production-ready full-stack application with real-time data sync, edge deployment, and type-safe development.

## Stack Overview

| Layer             | Technology               | Key Files                                  |
| ----------------- | ------------------------ | ------------------------------------------ |
| **Framework**     | TanStack Start           | `src/routes/`, `src/router.tsx`            |
| **Backend**       | Convex                   | `convex/`                                  |
| **Auth**          | Better Auth + Convex     | `convex/auth.ts`, `src/lib/auth-client.ts` |
| **Edge**          | Cloudflare Workers       | `wrangler.jsonc`, `src/server.ts`          |
| **Styling**       | Tailwind CSS v4          | `src/styles/`                              |
| **Rate Limiting** | @convex-dev/rate-limiter | `convex/lib/services/rateLimitService.ts`  |

## Architecture Concepts

### Data Flow

1. **SSR**: Cloudflare Workers fetch initial data from Convex via route loaders
2. **Hydration**: Client connects via WebSocket for real-time updates
3. **Mutations**: Optimistic UI with automatic sync

### Auth Pattern

- Better Auth runs within Convex HTTP actions
- Session stored in Convex database
- Frontend uses `useSession()` from `@/lib/auth-client`
- Sign-out reloads the page to reset Convex auth state
- `import.meta.env` is correct for Cloudflare Workers SSR (NOT `process.env`)
- Do NOT use `expectAuth: true` — it blocks ALL queries until auth resolves

### Rate Limiting

- Uses `@convex-dev/rate-limiter` component (persistent, distributed)
- In-memory rate limiting is broken for Convex (state doesn't persist across invocations)
- Define limits in `convex/lib/services/rateLimitService.ts`
- Use `rateLimiter.limit(ctx, 'operationName', { key })` in mutations

### File Organization

```
convex/            # Backend
├── auth.ts        # Better Auth configuration
├── schema.ts      # Database schema (uses _creationTime, not createdAt)
├── http.ts        # HTTP routes (auth endpoints)
├── convex.config.ts # Registers betterAuth + rateLimiter components
├── lib/           # Helpers (rateLimit, permissions)
│   ├── authHelpers.ts  # getAuthUser, getAuthUserSafe, requireAuth, requireAdmin, isAdmin
│   ├── config.ts       # ADMIN_EMAILS, ROLES
│   ├── services/       # rateLimitService (uses @convex-dev/rate-limiter)
│   └── middleware/      # withRateLimit decorator
└── *.ts           # Queries and mutations by domain

src/               # Frontend
├── routes/        # File-based routing
│   ├── __root.tsx # Root layout (dark mode script, ConvexBetterAuthProvider)
│   ├── index.tsx  # Home page (SSR loader, useSuspenseQuery)
│   └── _authenticated/  # Protected routes (redirects unauthenticated users)
├── components/    # React components
├── hooks/         # Custom hooks
└── lib/           # Utilities (auth-client, env, utils)
```

## Code Patterns

### Convex Functions

```typescript
// Query with auth (safe for SSR — returns null, doesn't throw)
import { getAuthUserSafe } from './lib/authHelpers'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx)
    if (!user) return []
    return await ctx.db.query('items').collect()
  },
})

// Mutation with auth (throws if not authenticated)
import { requireAuth } from './lib/authHelpers'

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    return await ctx.db.insert('items', { name: args.name, userId: user._id })
  },
})

// Admin-only mutation
import { requireAdmin } from './lib/authHelpers'

export const deleteAny = mutation({
  args: { id: v.id('items') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await ctx.db.delete(args.id)
  },
})
```

### Rate-Limited Mutation

```typescript
import { rateLimiter } from './lib/services/rateLimitService'

export const send = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    await rateLimiter.limit(ctx, 'sendMessage', { key: user._id })
    // ... mutation logic
  },
})
```

### TanStack Routes with SSR

```typescript
// Route with SSR data loading
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.messages.list, {}))
  },
  component: HomePage,
})

function HomePage() {
  // useSuspenseQuery for SSR-loaded data (no loading state needed)
  const { data } = useSuspenseQuery(convexQuery(api.items.list, {}))
  return <div>{/* ... */}</div>
}
```

### Components with Convex

```typescript
function ItemList() {
  const { data: items } = useSuspenseQuery(convexQuery(api.items.list, {}))
  const createItem = useConvexMutation(api.items.create)

  return (
    <ul>
      {items.map((item) => (
        <li key={item._id}>{item.name}</li>
      ))}
    </ul>
  )
}
```

## Common Tasks

### Adding a Convex Function

1. Define args with Convex validators (`v.string()`, `v.number()`, etc.) — NOT Zod
2. Use `requireAuth(ctx)` or `getAuthUserSafe(ctx)` for auth
3. Better Auth user IDs are `v.string()` (not `v.id('user')`)
4. Use `_creationTime` instead of manual `createdAt` fields
5. Export as `query` or `mutation`
6. Types auto-generated in `convex/_generated/`

### Adding a Route

1. Create file in `src/routes/` (auto-registers)
2. Use `_authenticated/` prefix for protected routes
3. Add `loader` for SSR data fetching
4. Run `npm run generate:routes` if types outdated

### Adding Auth Check

```typescript
import { requireAuth, getAuthUserSafe } from './lib/authHelpers'

// Throws if not authenticated (for mutations)
const user = await requireAuth(ctx)

// Returns null if not authenticated (for queries, SSR-safe)
const user = await getAuthUserSafe(ctx)
```

### Making a User Admin

Add their email to `ADMIN_EMAILS` in `convex/lib/config.ts`.

## Important Files

| Purpose         | File                                      |
| --------------- | ----------------------------------------- |
| Database schema | `convex/schema.ts`                        |
| Auth config     | `convex/auth.ts`                          |
| Auth helpers    | `convex/lib/authHelpers.ts`               |
| HTTP routes     | `convex/http.ts`                          |
| Rate limiting   | `convex/lib/services/rateLimitService.ts` |
| Frontend auth   | `src/lib/auth-client.ts`                  |
| Router setup    | `src/router.tsx`                          |
| Root layout     | `src/routes/__root.tsx`                   |
| Workers config  | `wrangler.jsonc`                          |
| Env validation  | `src/lib/env.ts`                          |

## Style Guidelines

- **TypeScript**: Strict mode, infer when possible
- **Convex**: Use `v` validators for args, NOT TypeScript types or Zod
- **Components**: Functional with hooks, collocate related files, max ~200 lines
- **Tailwind v4**: Use `@theme inline` with HEX colors, class-based dark mode (`.dark`)
- **Colors**: HEX only — no `oklch()`, `hsl()`, or `rgb()` (cross-browser consistency)
- **Naming**: camelCase (files/vars), PascalCase (components), kebab-case (hooks)
- **Aliases**: `@/` for `src/`, `@convex/` for `convex/`

## Environment Variables

- **Vite (client)**: `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_APP_ENV`
- **Convex (backend)**: Set via `npx convex env set KEY value`
  - `BETTER_AUTH_SECRET` (required, generate with `openssl rand -base64 32`)
  - `SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Mobile / Capacitor

This template supports native iOS/Android apps via Capacitor. See `docs/MOBILE.md` for the full setup guide.

### Key Patterns

- **Dual build**: `npm run build` produces SSR output (Cloudflare) + SPA shell (Capacitor). Both from one codebase.
- **Platform detection**: Use `src/lib/platform.ts` (`isNative()`, `isIOS()`, `isAndroid()`) to branch behavior.
- **Auth on native**: Google OAuth doesn't work from WebViews. Use `better-auth-capacitor` to open OAuth in the system browser + handle callback via deep links. **Critical**: Convex runtime requires a Cookie Bridge Proxy in `convex/http.ts` because Better Auth's 302 redirects bypass plugin after-hooks. See `docs/MOBILE.md` → "OAuth / Sign-In on Native" for the full pattern.
- **Auth baseURL**: Native apps must use `VITE_CONVEX_SITE_URL` (the Convex HTTP endpoint), not relative URLs. Web apps use `undefined` (relative to origin).
- **CORS**: `registerRoutes()` must include `cors` options for Capacitor WebView cross-origin requests to work.
- **Safe areas**: Use `env(safe-area-inset-*)` CSS variables for status bar, notch, and home indicator spacing.
- **SSR graceful fallback**: `getAuth()` server functions must be wrapped in try/catch — they fail in SPA mode (no server).
