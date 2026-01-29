---
description: Add a new React component with Convex integration
mode: agent
tools: ['editFiles']
---

# Add React Component

Create a new React component with optional Convex data integration.

## Required Information

1. **Component Name**: PascalCase (e.g., `ItemCard`, `UserProfile`)
2. **Purpose**: What does it display/do?
3. **Data**: Needs Convex query/mutation?
4. **Props**: What inputs does it accept?

## Templates

### Basic Component
Location: `src/components/{ComponentName}.tsx`

```typescript
interface ComponentNameProps {
  title: string;
  children?: React.ReactNode;
}

export function ComponentName({ title, children }: ComponentNameProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
```

### Component with Convex Query
```typescript
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

interface ItemCardProps {
  itemId: Id<"items">;
}

export function ItemCard({ itemId }: ItemCardProps) {
  const item = useQuery(api.items.get, { id: itemId });

  if (!item) {
    return (
      <div className="animate-pulse rounded-lg bg-gray-100 h-24" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium">{item.name}</h3>
      <p className="text-sm text-gray-600">{item.description}</p>
    </div>
  );
}
```

### Component with Convex Mutation
```typescript
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export function CreateItemForm() {
  const [name, setName] = useState("");
  const createItem = useMutation(api.items.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    await createItem({ name });
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="w-full rounded border px-3 py-2"
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Create
      </button>
    </form>
  );
}
```

### List Component
```typescript
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function ItemList() {
  const items = useQuery(api.items.list);

  if (!items) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse rounded bg-gray-100 h-16" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        No items yet
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item._id} className="rounded border p-3">
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

## Checklist

- [ ] File location: `src/components/{ComponentName}.tsx`
- [ ] PascalCase naming
- [ ] Loading state for async data
- [ ] Empty state for lists
- [ ] Props interface defined
- [ ] Accessible (semantic HTML, ARIA if needed)

## Tailwind Patterns

| Element | Classes |
|---------|---------|
| Card | `rounded-lg border border-gray-200 p-4` |
| Button Primary | `rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700` |
| Button Secondary | `rounded border border-gray-300 px-4 py-2 hover:bg-gray-50` |
| Input | `w-full rounded border px-3 py-2` |
| Loading Skeleton | `animate-pulse rounded bg-gray-100` |
