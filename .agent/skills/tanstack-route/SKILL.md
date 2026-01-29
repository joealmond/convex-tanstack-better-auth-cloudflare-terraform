---
name: tanstack-route
description: Create TanStack Start file-based routes with proper SEO, data loading, and authentication. Use this skill when adding new pages or routes to the application.
---

# Create TanStack Route

Create a new file-based route for TanStack Start with proper structure.

## Goal

Generate a properly configured route with:
- Correct file location matching URL path
- SEO meta tags
- Data loading (if needed)
- Authentication (for protected routes)

## Instructions

### 1. Determine Route Type

| Type | Location | Use When |
|------|----------|----------|
| Public | `src/routes/{path}.tsx` | No auth needed |
| Protected | `src/routes/_authed/{path}.tsx` | Requires login |

### 2. File Naming Rules

| URL | File Path |
|-----|-----------|
| `/` | `src/routes/index.tsx` |
| `/about` | `src/routes/about.tsx` |
| `/products` | `src/routes/products/index.tsx` |
| `/products/:id` | `src/routes/products/$id.tsx` |
| `/dashboard` (auth) | `src/routes/_authed/dashboard.tsx` |

### 3. Route Structure

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/path")({
  component: PageComponent,
  head: () => ({
    meta: [
      { title: "Page Title | App Name" },
      { name: "description", content: "Page description" },
    ],
  }),
});

function PageComponent() {
  return <div>Content</div>;
}
```

### 4. Data Loading with Convex

Use `useQuery` for reactive data:

```typescript
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

function PageComponent() {
  const data = useQuery(api.resource.list);
  
  if (!data) return <Loading />;
  
  return <div>{/* render data */}</div>;
}
```

### 5. Dynamic Parameters

Access route params via `Route.useParams()`:

```typescript
function ProductPage() {
  const { productId } = Route.useParams();
  const product = useQuery(api.products.get, { id: productId });
  // ...
}
```

## Constraints

- **DO NOT** use `useEffect` for data fetching (use Convex `useQuery`)
- **DO NOT** forget loading states for async data
- **DO NOT** skip SEO meta tags
- **DO** run `npm run generate:routes` if types are stale

## Examples

See `examples/` directory for:
- `public-route.tsx` - Public page with SEO
- `protected-route.tsx` - Auth-required page with data
