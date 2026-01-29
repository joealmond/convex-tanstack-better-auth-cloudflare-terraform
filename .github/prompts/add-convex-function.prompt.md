---
description: Add a new Convex query or mutation
mode: agent
tools: ['editFiles', 'runTerminal']
---

# Add Convex Function

Create a new Convex function (query or mutation) following best practices.

## Required Information

1. **Function Name**: What should it be called?
2. **Type**: `query` (read data) or `mutation` (write data)
3. **Table**: Which table(s) does it interact with?
4. **Args**: What parameters does it accept?
5. **Auth Required?**: Does it need authentication?

## Template

### Query (Read Data)
```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const functionName = query({
  args: {
    // Define args with Convex validators
    // id: v.id("tableName"),
    // search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth check (if protected)
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Query data
    return await ctx.db.query("tableName")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});
```

### Mutation (Write Data)
```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const functionName = mutation({
  args: {
    // Define args with Convex validators
    // name: v.string(),
    // status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
  },
  handler: async (ctx, args) => {
    // Auth check
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Validate (if needed)
    if (!args.name?.trim()) throw new Error("Name is required");

    // Insert/Update
    return await ctx.db.insert("tableName", {
      ...args,
      userId,
      createdAt: Date.now(),
    });
  },
});
```

## Checklist

- [ ] File location: `convex/{domain}.ts`
- [ ] Args use Convex validators (`v.string()`, not TypeScript)
- [ ] Auth check for protected functions
- [ ] Ownership check (user can only access their data)
- [ ] Run `npm run dev` to regenerate types in `convex/_generated/`

## Common Validators

| Type | Validator |
|------|-----------|
| String | `v.string()` |
| Number | `v.number()` |
| Boolean | `v.boolean()` |
| ID Reference | `v.id("tableName")` |
| Optional | `v.optional(v.string())` |
| Enum | `v.union(v.literal("a"), v.literal("b"))` |
| Array | `v.array(v.string())` |
| Object | `v.object({ key: v.string() })` |
