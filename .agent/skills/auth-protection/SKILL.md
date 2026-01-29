---
name: auth-protection
description: Add authentication and authorization to Convex functions and routes. Use this skill when protecting resources with user auth or role-based access control (RBAC).
---

# Add Authentication Protection

Implement authentication and authorization patterns for this stack.

## Goal

Secure resources with:
- User authentication (logged in)
- Ownership verification (user's own data)
- Role-based access control (admin, user, etc.)

## Instructions

### 1. Convex Function Authentication

Add to any protected query/mutation:

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

export const myFunction = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    // Now userId is available for scoping
  },
});
```

### 2. Ownership Verification

Ensure users can only access their own resources:

```typescript
const item = await ctx.db.get(itemId);
if (!item) throw new Error("Not found");
if (item.userId !== userId) throw new Error("Forbidden");
```

### 3. Role-Based Access (RBAC)

For admin-only functions:

```typescript
const user = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("_id"), userId))
  .first();

if (user?.role !== "admin") {
  throw new Error("Forbidden: Admin access required");
}
```

### 4. Protected Routes (Frontend)

Place route files in `_authed/` directory:

```
src/routes/
├── index.tsx          # Public
├── about.tsx          # Public
└── _authed/           # All routes here require auth
    ├── dashboard.tsx
    └── settings.tsx
```

The `_authed` layout checks session and redirects to login.

### 5. Client-Side Auth Check

```typescript
import { useSession } from "@/lib/auth-client";

function ProfileButton() {
  const { data: session, isPending } = useSession();
  
  if (isPending) return <Skeleton />;
  if (!session) return <LoginButton />;
  
  return <UserMenu user={session.user} />;
}
```

## Authorization Patterns

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Authenticated | Any logged-in user | `getAuthUserId(ctx)` |
| Owner | User's own data | Compare `userId` fields |
| Role-based | Admin actions | Check `user.role` |
| Resource-based | Item permissions | Check `item.permissions` array |

## Constraints

- **DO NOT** skip auth checks on mutations
- **DO NOT** trust client-side role checks alone
- **DO NOT** expose user IDs in error messages
- **DO** use generic error messages for security

## Examples

See `examples/` directory for:
- `protected-query.ts` - Query with user scoping
- `rbac-check.ts` - Role-based admin access
