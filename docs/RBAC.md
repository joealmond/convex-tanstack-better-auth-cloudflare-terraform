# Role-Based Access Control (RBAC)

This template includes a complete RBAC system for managing user permissions. Users can be either regular users or admins, with admins having elevated privileges.

## Quick Start

### 1. Make Yourself an Admin

**Option A: Email Whitelist (Recommended for development)**

Edit `convex/lib/config.ts`:

```ts
export const ADMIN_EMAILS: string[] = [
  'your-email@example.com', // Add your email here
]
```

**Option B: Convex Dashboard**

1. Open the [Convex Dashboard](https://dashboard.convex.dev)
2. Go to your project → Functions
3. Run the `users.setAdminByEmail` mutation:
   ```json
   { "email": "your-email@example.com", "isAdmin": true }
   ```

### 2. Sign In

Once configured, sign in with your admin email. You'll see:

- An "Admin" badge next to your name
- A floating admin toolbar at the bottom-right
- Delete buttons on all messages (not just your own)

---

## Architecture

### Files Overview

```
convex/
├── lib/
│   ├── config.ts        # ADMIN_EMAILS and role definitions
│   └── authHelpers.ts   # requireAuth, requireAdmin helpers
└── users.ts             # User queries and mutations

src/
├── hooks/
│   ├── use-admin.ts     # useAdmin() hook
│   └── use-impersonate.tsx  # "View as User" feature
└── components/
    └── AdminToolbar.tsx # Floating admin controls
```

### Admin Detection Logic

A user is considered an admin if **either**:

1. Their email is in `ADMIN_EMAILS` (in `convex/lib/config.ts`), OR
2. Their user record has `role: 'admin'` in the database

```ts
// This is how admin status is determined
function isAdmin(user: AuthUser): boolean {
  if (ADMIN_EMAILS.includes(user.email)) return true
  return user.role === 'admin'
}
```

---

## Backend Usage

### Require Authentication

```ts
import { requireAuth } from './lib/authHelpers'

export const myMutation = mutation({
  handler: async (ctx) => {
    const user = await requireAuth(ctx) // Throws if not logged in
    // user.email, user.name, user._id are available
  },
})
```

### Require Admin

```ts
import { requireAdmin } from './lib/authHelpers'

export const adminOnlyMutation = mutation({
  handler: async (ctx) => {
    const user = await requireAdmin(ctx) // Throws if not admin
    // Only admins can reach this code
  },
})
```

### Check Admin Without Throwing

```ts
import { getAuthUser, isAdmin } from './lib/authHelpers'

export const myQuery = query({
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (user && isAdmin(user)) {
      // User is admin - show extra data
    }
  },
})
```

---

## Frontend Usage

### useAdmin Hook

```tsx
import { useAdmin } from '@/hooks/use-admin'

function MyComponent() {
  const { isAdmin, isRealAdmin, isLoading } = useAdmin()

  if (isLoading) return <Spinner />

  return (
    <div>
      {isAdmin && <AdminPanel />}
      {/* isRealAdmin ignores "View as User" mode */}
    </div>
  )
}
```

### Admin Badge Example

```tsx
import { useAdmin } from '@/hooks/use-admin'
import { Shield } from 'lucide-react'

function UserBadge({ userName }) {
  const { isAdmin } = useAdmin()

  return (
    <div className="flex items-center gap-2">
      <span>{userName}</span>
      {isAdmin && (
        <span className="badge">
          <Shield className="w-3 h-3" />
          Admin
        </span>
      )}
    </div>
  )
}
```

### Conditional Actions

```tsx
import { useAdmin } from '@/hooks/use-admin'

function MessageCard({ message, isOwner }) {
  const { isAdmin } = useAdmin()
  const canDelete = isOwner || isAdmin

  return (
    <div>
      <p>{message.content}</p>
      {canDelete && <DeleteButton messageId={message._id} />}
    </div>
  )
}
```

---

## "View as User" Feature

Admins can toggle "View as User" mode to see the app as a regular user would. This is useful for testing the user experience.

### How It Works

1. Admin clicks "View as User" in the floating toolbar
2. `useAdmin()` returns `isAdmin: false` (but `isRealAdmin: true`)
3. Admin features are hidden from the UI
4. Click "Back to Admin" to restore admin view

### Using in Components

```tsx
import { useAdmin } from '@/hooks/use-admin'
import { useImpersonate } from '@/hooks/use-impersonate'

function AdminFeature() {
  const { isAdmin, isRealAdmin } = useAdmin()
  const { isViewingAsUser, toggleViewAsUser } = useImpersonate()

  // isAdmin = false when viewing as user
  // isRealAdmin = true (actual admin status)

  if (!isAdmin) return null
  return <AdminOnlyContent />
}
```

---

## API Reference

### Backend Functions

| Function                | Type     | Description                    |
| ----------------------- | -------- | ------------------------------ |
| `users.current`         | Query    | Get current authenticated user |
| `users.isAdmin`         | Query    | Check if current user is admin |
| `users.setAdminByEmail` | Mutation | Grant/revoke admin role        |

### Backend Helpers

| Function            | Description             |
| ------------------- | ----------------------- |
| `getAuthUser(ctx)`  | Get user or null        |
| `requireAuth(ctx)`  | Get user or throw       |
| `requireAdmin(ctx)` | Get admin user or throw |
| `isAdmin(user)`     | Check if user is admin  |

### Frontend Hooks

| Hook               | Returns                                      |
| ------------------ | -------------------------------------------- |
| `useAdmin()`       | `{ isAdmin, isRealAdmin, isLoading }`        |
| `useImpersonate()` | `{ isViewingAsUser, toggleViewAsUser, ... }` |

---

## Security Considerations

### Protecting Mutations

Always use `requireAdmin` for sensitive operations:

```ts
export const deleteUser = mutation({
  args: { userId: v.id('user') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx) // 🔒 Only admins
    await ctx.db.delete(args.userId)
  },
})
```

### Protecting the setAdminByEmail Mutation

By default, `setAdminByEmail` can be called by anyone (for easy initial setup). For production, uncomment the authorization check in `convex/users.ts`:

```ts
// Uncomment these lines in production:
const currentUser = await authComponent.getAuthUser(ctx)
const isCurrentUserAdmin =
  currentUser && (ADMIN_EMAILS.includes(currentUser.email) || currentUser.role === ROLES.ADMIN)
if (!isCurrentUserAdmin) {
  throw new Error('Only admins can modify user roles')
}
```

### Frontend Security Note

Frontend checks (`useAdmin`) are for **UX only**. Always enforce permissions on the backend with `requireAdmin`.

---

## Extending RBAC

### Adding More Roles

1. Update `convex/lib/config.ts`:

```ts
export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
} as const
```

2. Add helper function in `authHelpers.ts`:

```ts
export function isModerator(user: AuthUser): boolean {
  return user.role === ROLES.MODERATOR || isAdmin(user)
}

export async function requireModerator(ctx: AuthContext): Promise<AuthUser> {
  const user = await requireAuth(ctx)
  if (!isModerator(user)) {
    throw new Error('Moderator access required')
  }
  return user
}
```

3. Create frontend hook:

```ts
export function useModerator() {
  const { data: user } = useQuery(convexQuery(api.users.current, {}))
  return {
    isModerator: user?.role === 'moderator' || user?.role === 'admin',
  }
}
```
