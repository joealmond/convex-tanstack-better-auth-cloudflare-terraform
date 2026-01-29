---
name: react-component
description: Create React components with Convex integration, Tailwind styling, and proper TypeScript types. Use this skill when building UI components.
---

# Create React Component

Build React components with Convex hooks and Tailwind CSS.

## Goal

Generate reusable, well-typed React components with:
- Props interface for type safety
- Convex hooks for data (if needed)
- Tailwind CSS styling
- Loading and empty states
- Accessibility considerations

## Instructions

### 1. Component Structure

```typescript
// src/components/ComponentName.tsx

interface ComponentNameProps {
  // Define all props with types
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // Component logic
  return <div>...</div>;
}
```

### 2. With Convex Query

```typescript
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function ItemList() {
  const items = useQuery(api.items.list);
  
  if (!items) return <LoadingState />;
  if (items.length === 0) return <EmptyState />;
  
  return <ul>{items.map(...)}</ul>;
}
```

### 3. With Convex Mutation

```typescript
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export function CreateForm() {
  const createItem = useMutation(api.items.create);
  
  const handleSubmit = async (data: FormData) => {
    await createItem({ name: data.get("name") as string });
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 4. State Handling

Always handle these states:
- **Loading**: Show skeleton/spinner while data loads
- **Empty**: Friendly message when no data exists
- **Error**: Display error message (catch in mutation)

### 5. Tailwind Patterns

| Element | Recommended Classes |
|---------|---------------------|
| Card | `rounded-lg border border-gray-200 p-4` |
| Button (primary) | `bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700` |
| Button (secondary) | `border border-gray-300 px-4 py-2 rounded hover:bg-gray-50` |
| Input | `w-full rounded border px-3 py-2` |
| Skeleton | `animate-pulse bg-gray-100 rounded` |

## Constraints

- **DO NOT** fetch data with `useEffect` (use Convex `useQuery`)
- **DO NOT** skip loading states for async components
- **DO NOT** use inline styles (use Tailwind)
- **DO** export components as named exports

## Examples

See `examples/` directory for:
- `list-component.tsx` - List with loading/empty states
- `form-component.tsx` - Form with mutation
