# Convex + TanStack Start + Cloudflare Workers

This template provides a modern, production-ready full-stack application with real-time data sync, edge deployment, and type-safe development.

## Stack Overview

| Layer | Technology | Key Files |
|-------|------------|-----------|
| **Framework** | TanStack Start | `src/routes/`, `src/router.tsx` |
| **Backend** | Convex | `convex/` |
| **Auth** | Better Auth + Convex | `convex/auth.ts`, `src/lib/auth-client.ts` |
| **Edge** | Cloudflare Workers | `wrangler.jsonc`, `src/server.ts` |
| **Styling** | Tailwind CSS v4 | `src/styles/` |

## Architecture Concepts

### Data Flow
1. **SSR**: Cloudflare Workers fetch initial data from Convex
2. **Hydration**: Client connects via WebSocket for real-time updates
3. **Mutations**: Optimistic UI with automatic sync

### Auth Pattern
- Better Auth runs within Convex HTTP actions
- Session stored in Convex database
- Frontend uses `useSession()` from `@/lib/auth-client`

### File Organization

```
convex/            # Backend
├── auth.ts        # Better Auth configuration
├── schema.ts      # Database schema
├── http.ts        # HTTP routes (auth endpoints)
├── lib/           # Helpers (rateLimit, permissions)
└── *.ts           # Queries and mutations by domain

src/               # Frontend
├── routes/        # File-based routing
│   ├── __root.tsx # Root layout
│   ├── index.tsx  # Home page
│   └── _authed/   # Protected routes
├── components/    # React components
├── hooks/         # Custom hooks
└── lib/           # Utilities (auth-client, env, utils)
```

## Code Patterns

### Convex Functions

```typescript
// Query with auth
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserId(ctx);
    if (!user) throw new Error("Unauthorized");
    return await ctx.db.query("items").collect();
  },
});

// Mutation with validation
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUserId(ctx);
    if (!user) throw new Error("Unauthorized");
    return await ctx.db.insert("items", { name: args.name, userId: user });
  },
});
```

### TanStack Routes

```typescript
// Protected route with data loading
export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
  loader: async () => {
    // Data loaded server-side
  },
});

function DashboardPage() {
  const { data } = useQuery(api.items.list);
  return <div>{/* ... */}</div>;
}
```

### Components with Convex

```typescript
function ItemList() {
  const items = useQuery(api.items.list);
  const createItem = useMutation(api.items.create);
  
  if (!items) return <Loading />;
  
  return (
    <ul>
      {items.map((item) => (
        <li key={item._id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

## Common Tasks

### Adding a Convex Function
1. Define args with Convex validators (`v.string()`, `v.number()`, etc.)
2. Use `getAuthUserId(ctx)` for auth
3. Export as `query` or `mutation`
4. Types auto-generated in `convex/_generated/`

### Adding a Route
1. Create file in `src/routes/` (auto-registers)
2. Use `_authed/` prefix for protected routes
3. Run `npm run generate:routes` if types outdated

### Adding Auth Check
```typescript
import { getAuthUserId } from "@convex-dev/auth/server";
const userId = await getAuthUserId(ctx);
if (!userId) throw new Error("Unauthorized");
```

## Important Files

| Purpose | File |
|---------|------|
| Database schema | `convex/schema.ts` |
| Auth config | `convex/auth.ts` |
| HTTP routes | `convex/http.ts` |
| Rate limiting | `convex/lib/rateLimiter.ts` |
| Frontend auth | `src/lib/auth-client.ts` |
| Router setup | `src/router.tsx` |
| Root layout | `src/routes/__root.tsx` |
| Workers config | `wrangler.jsonc` |

## Style Guidelines

- **TypeScript**: Strict mode, infer when possible
- **Convex**: Use validators, not TypeScript types for args
- **Components**: Functional with hooks, collocate related files
- **Tailwind**: Use design tokens, avoid arbitrary values
- **Naming**: camelCase (files/vars), PascalCase (components)

## Environment Variables

- **Vite (client)**: `VITE_CONVEX_URL`
- **Convex (backend)**: Set via `npx convex env set KEY value`
  - `SITE_URL`, `BETTER_AUTH_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
