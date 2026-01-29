---
name: convex-function
description: Create Convex queries and mutations with proper authentication, validation, and TypeScript typing. Use this skill when adding new backend functions to the Convex backend.
---

# Create Convex Function

Create a new Convex query or mutation following best practices for this stack.

## Goal

Generate a properly typed and secured Convex function with:
- Convex validators for type-safe arguments
- Authentication check using Better Auth
- Proper error handling
- Database operations with indexes

## Instructions

### 1. Determine Function Type

| Type | Use When |
|------|----------|
| `query` | Reading data (reactive, cached) |
| `mutation` | Writing data (insert, update, delete) |
| `action` | External API calls, non-deterministic ops |

### 2. Define Arguments with Validators

Always use Convex validators, never TypeScript types:

```typescript
import { v } from "convex/values";

args: {
  id: v.id("tableName"),           // Document reference
  name: v.string(),                 // Required string
  count: v.optional(v.number()),    // Optional number
  status: v.union(v.literal("draft"), v.literal("published")),
}
```

### 3. Add Authentication

For protected functions, always check auth first:

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (!userId) throw new Error("Unauthorized");
```

### 4. Scope Data to User

Ensure users can only access their own data:

```typescript
// Query with user filter
const items = await ctx.db.query("items")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();

// Single item ownership check
const item = await ctx.db.get(id);
if (item?.userId !== userId) throw new Error("Forbidden");
```

### 5. File Location

Place in `convex/{domain}.ts` where domain matches the resource:
- `convex/items.ts` for item functions
- `convex/users.ts` for user functions

## Constraints

- **DO NOT** use TypeScript types for args (use Convex validators)
- **DO NOT** skip auth checks on protected functions
- **DO NOT** return data without ownership verification
- **DO** add indexes for filtered queries in schema.ts

## Examples

See `examples/` directory for:
- `query.ts` - Read operation with auth
- `mutation.ts` - Write operation with validation
