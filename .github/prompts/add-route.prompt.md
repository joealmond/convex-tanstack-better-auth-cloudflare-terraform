---
description: Add a new TanStack Start route
mode: agent
tools: ['editFiles', 'runTerminal']
---

# Add TanStack Route

Create a new file-based route for TanStack Start.

## Required Information

1. **Route Path**: URL path (e.g., `/dashboard`, `/products/$id`)
2. **Protected?**: Requires authentication?
3. **Data Loading**: What data does it need?
4. **SEO**: Title, description

## Route Types

### Public Route
Location: `src/routes/{path}.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/example")({
  component: ExamplePage,
  head: () => ({
    meta: [
      { title: "Example | My App" },
      { name: "description", content: "Example page description" },
    ],
  }),
});

function ExamplePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Example</h1>
    </div>
  );
}
```

### Protected Route
Location: `src/routes/_authenticated/{path}.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard | My App" }],
  }),
});

function DashboardPage() {
  const { data: items } = useSuspenseQuery(
    convexQuery(api.items.list, {})
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {/* Content */}
    </div>
  );
}
```

### Dynamic Route (with params)
Location: `src/routes/{parent}/$paramName.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/products/$productId")({
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const { data: product } = useSuspenseQuery(
    convexQuery(api.products.get, { id: productId })
  );

  return (
    <div>
      <h1>{product.name}</h1>
    </div>
  );
}
```

## Checklist

- [ ] File in correct location (`src/routes/` or `src/routes/_authenticated/`)
- [ ] Route path matches file location
- [ ] SEO meta tags in `head()`
- [ ] Uses `useSuspenseQuery` + `convexQuery()` for data (NOT raw `useQuery`)
- [ ] SSR routes use `loader` with `ensureQueryData`
- [ ] Run `npm run generate:routes` after adding new routes

## File Naming Rules

| URL | File Path |
|-----|-----------|
| `/` | `src/routes/index.tsx` |
| `/about` | `src/routes/about.tsx` |
| `/products` | `src/routes/products/index.tsx` |
| `/products/:id` | `src/routes/products/$id.tsx` |
| `/dashboard` (protected) | `src/routes/_authenticated/dashboard.tsx` |
