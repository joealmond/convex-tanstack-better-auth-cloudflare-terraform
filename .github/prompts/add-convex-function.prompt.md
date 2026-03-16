---
description: Add a new Convex query or mutation
mode: agent
tools: ['editFiles', 'runTerminal']
---

# Add Convex Function

Create a new Convex function (query or mutation) following best practices.
Always use custom wrappers from `convex/lib/customFunctions.ts` — NEVER use raw `query`/`mutation` from `_generated/server`.

## Required Information

1. **Function Name**: What should it be called?
2. **Type**: `query` (read data) or `mutation` (write data)
3. **Table**: Which table(s) does it interact with?
4. **Args**: What parameters does it accept?
5. **Auth Required?**: Does it need authentication?

## Template

### Public Query (no auth, SSR-safe)
```typescript
import { v } from "convex/values";
import { publicQuery } from "./lib/customFunctions";
import { getAuthUserSafe } from "./lib/authHelpers";

export const list = publicQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx);
    if (!user) return [];
    return await ctx.db.query("tableName").collect();
  },
});
```

### Authenticated Query
```typescript
import { v } from "convex/values";
import { authQuery } from "./lib/customFunctions";

export const get = authQuery({
  args: {
    id: v.id("tableName"),
  },
  handler: async (ctx, args) => {
    // ctx.user and ctx.userId are auto-injected
    return await ctx.db.get(args.id);
  },
});
```

### Authenticated Mutation
```typescript
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { authMutation } from "./lib/customFunctions";

export const create = authMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // ctx.user and ctx.userId are guaranteed
    if (!args.name.trim()) throw new ConvexError("Name is required");

    return await ctx.db.insert("tableName", {
      name: args.name,
      userId: ctx.userId,
    });
  },
});
```

### Admin Mutation
```typescript
import { v } from "convex/values";
import { adminMutation } from "./lib/customFunctions";

export const deleteAny = adminMutation({
  args: { id: v.id("tableName") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
```

## Available Wrappers

| Wrapper | Auth | Use Case |
|---------|------|----------|
| `publicQuery` | None | Public reads, SSR loaders |
| `publicMutation` | None | Anonymous writes |
| `authQuery` | Required | Authenticated reads |
| `authMutation` | Required | Authenticated writes |
| `adminQuery` | Admin only | Admin dashboards |
| `adminMutation` | Admin only | Admin operations |

## Checklist

- [ ] File location: `convex/{domain}.ts`
- [ ] Uses custom wrapper from `convex/lib/customFunctions.ts` (NOT raw `query`/`mutation`)
- [ ] Args use Convex validators (`v.string()`, not TypeScript or Zod)
- [ ] Uses `ConvexError` for user-facing errors (NOT raw `Error`)
- [ ] Uses `_creationTime` instead of manual `createdAt` fields
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
