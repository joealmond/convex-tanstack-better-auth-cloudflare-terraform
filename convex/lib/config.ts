/**
 * App Configuration
 * =================
 *
 * Centralized configuration for the Convex backend.
 * Edit this file to customize your application settings.
 */

/**
 * Admin Email Whitelist
 * ---------------------
 *
 * Users with these email addresses automatically get admin privileges.
 * This is the easiest way to set up your first admin account.
 *
 * How to use:
 * 1. Add your email address to the array below
 * 2. Deploy with `npx convex deploy` or let `npx convex dev` sync
 * 3. Sign in with that email - you're now an admin!
 *
 * Alternative: Use the Convex dashboard to run:
 *   users.setAdminByEmail({ email: "your@email.com", isAdmin: true })
 *
 * @example
 * ```ts
 * export const ADMIN_EMAILS: string[] = [
 *   "admin@yourcompany.com",
 *   "developer@yourcompany.com",
 * ]
 * ```
 */
export const ADMIN_EMAILS: string[] = [
  // 👇 Add your admin emails here:
  // "your-email@example.com",
]

/**
 * Role Definitions
 * ----------------
 *
 * Define your application roles here.
 * Extend this as needed for more complex RBAC.
 */
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]
