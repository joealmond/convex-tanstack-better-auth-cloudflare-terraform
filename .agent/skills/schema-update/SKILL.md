---
name: schema-update
description: Extend the Convex database schema with proper types, indexes, and validators. Use this skill when adding new tables or modifying the database structure.
---

# Update Convex Schema

Extend or modify the Convex database schema.

## Goal

Design and implement schema changes with:
- Proper Convex validators
- Indexes for efficient queries
- Foreign key relationships
- Migration considerations

## Instructions

### 1. Location

Schema is defined in `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tables go here
});
```

### 2. Define Tables

```typescript
export default defineSchema({
  items: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    userId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
```

### 3. Add Indexes

Index any field you filter or sort by:

```typescript
items: defineTable({
  // fields...
})
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_user_and_status", ["userId", "status"]),
```

### 4. Common Validators

| Type | Validator | Example |
|------|-----------|---------|
| String | `v.string()` | `name: v.string()` |
| Number | `v.number()` | `price: v.number()` |
| Boolean | `v.boolean()` | `isActive: v.boolean()` |
| Optional | `v.optional()` | `bio: v.optional(v.string())` |
| ID | `v.id("table")` | `userId: v.id("users")` |
| Enum | `v.union(v.literal())` | `status: v.union(v.literal("a"), v.literal("b"))` |
| Array | `v.array()` | `tags: v.array(v.string())` |
| Object | `v.object()` | `meta: v.object({ key: v.string() })` |
| Union | `v.union()` | `v.union(v.string(), v.null())` |

### 5. Foreign Keys Pattern

Reference other tables with `v.id()`:

```typescript
comments: defineTable({
  content: v.string(),
  postId: v.id("posts"),      // References posts table
  authorId: v.id("users"),    // References users table
})
  .index("by_post", ["postId"])
  .index("by_author", ["authorId"]),
```

### 6. After Schema Changes

1. `npm run dev` to regenerate types
2. Types appear in `convex/_generated/dataModel.d.ts`
3. Existing data is NOT migrated automatically

## Schema Conventions

- Use `camelCase` for field names
- Add `createdAt` and `updatedAt` timestamps
- Include `userId` for user-owned data
- Create indexes for all filtered fields
- Use enums for fixed status values

## Constraints

- **DO NOT** remove fields with existing data (breaks reads)
- **DO NOT** use TypeScript types (use Convex validators)
- **DO** plan migrations for breaking changes
- **DO** add indexes BEFORE deploying queries that need them

## Examples

See `examples/` directory for:
- `table-with-indexes.ts` - Complete table example
