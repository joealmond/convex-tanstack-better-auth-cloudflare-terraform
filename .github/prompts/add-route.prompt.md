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
Location: `src/routes/_authed/{path}.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard | My App" }],
  }),
});

function DashboardPage() {
  const items = useQuery(api.items.list);

  if (!items) {
    return <div className="animate-pulse">Loading...</div>;
  }

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
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/products/$productId")({
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const product = useQuery(api.products.get, { id: productId });

  if (!product) return <div>Loading...</div>;

  return (
    <div>
      <h1>{product.name}</h1>
    </div>
  );
}
```

## Checklist

- [ ] File in correct location (`src/routes/` or `src/routes/_authed/`)
- [ ] Route path matches file location
- [ ] SEO meta tags in `head()`
- [ ] Loading state handled for async data
- [ ] Run `npm run generate:routes` if types outdated

## File Naming Rules

| URL | File Path |
|-----|-----------|
| `/` | `src/routes/index.tsx` |
| `/about` | `src/routes/about.tsx` |
| `/products` | `src/routes/products/index.tsx` |
| `/products/:id` | `src/routes/products/$id.tsx` |
| `/dashboard` (protected) | `src/routes/_authed/dashboard.tsx` |
