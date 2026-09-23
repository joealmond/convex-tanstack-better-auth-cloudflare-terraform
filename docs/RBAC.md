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

The account must also have `emailVerified: true`. Use Google sign-in with a verified email,
or configure Better Auth email verification before using an email/password account as an
allowlisted admin. Plain email/password signup remains available for regular users.

**Option B: Server-managed role**

A trusted server-managed `role: 'admin'` also grants access. Better Auth's admin plugin is not
enabled by this starter; adding it requires its component schema and server-side configuration.
For Clerk, use a server-managed role claim, never client-editable user metadata.
There is no public mutation for promoting users.

### 2. Sign In

Once configured, sign in with your verified admin email. You'll see:

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

1. Their email is verified and is in `ADMIN_EMAILS` (in `convex/lib/config.ts`), OR
2. Their user record has `role: 'admin'` in the database

```ts
// This is how admin status is determined
function isAdmin(user: AuthUser): boolean {
  if (user.emailVerified === true && ADMIN_EMAILS.includes(user.email)) return true
  return user.role === 'admin'
}
```

---

## Backend Usage

### Require Authentication

```ts
import { authMutation } from './lib/customFunctions'

export const myMutation = authMutation({
  handler: async (ctx) => {
    // ctx.user and ctx.userId are auto-injected
    // ctx.user.email, ctx.user.name, ctx.userId are available
  },
})
```

### Require Admin

```ts
import { adminMutation } from './lib/customFunctions'

export const adminOnlyMutation = adminMutation({
  handler: async (ctx) => {
    // ctx.user is guaranteed to be an admin
    // Only admins can reach this code
  },
})
```

### Check Admin Without Throwing

```ts
import { publicQuery } from './lib/customFunctions'
import { getAuthUserSafe, isAdmin } from './lib/authHelpers'

export const myQuery = publicQuery({
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx)
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

| Function        | Type  | Description                    |
| --------------- | ----- | ------------------------------ |
| `users.current` | Query | Get current authenticated user |
| `users.isAdmin` | Query | Check if current user is admin |

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

Always use `adminMutation` for sensitive operations:

```ts
export const deleteUser = adminMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // 🔒 ctx.user is guaranteed admin by wrapper
    // Delete user data (messages, files, etc.)
  },
})
```

### Email ownership

The backend checks `emailVerified === true` before using `ADMIN_EMAILS`. Missing verification
claims fail closed. Clerk's Convex JWT must contain the provider's verified email and
`email_verified` claims; configure those in the Clerk dashboard if they are absent.
Do not remove this check to make a development account an admin.

### Frontend Security Note

Frontend checks (`useAdmin`) are for **UX only**. Always enforce permissions on the backend using `authMutation`/`adminMutation` wrappers from `lib/customFunctions.ts`.

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
