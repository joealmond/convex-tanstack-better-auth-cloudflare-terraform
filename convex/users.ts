/**
 * User Queries & Mutations
 * ========================
 *
 * This module provides user-related Convex functions for the frontend.
 *
 * ## Available Functions
 *
 * - `users.current` - Get the current authenticated user
 * - `users.isAdmin` - Check if current user is an admin
 *
 * ## Usage
 *
 * ```tsx
 * import { useQuery } from '@tanstack/react-query'
 * import { convexQuery } from '@convex-dev/react-query'
 * import { api } from '@convex/_generated/api'
 *
 * // Check admin status
 * const { data: isAdmin } = useQuery(convexQuery(api.users.isAdmin, {}))
 * ```
 *
 * ## Making a User Admin
 *
 * Option 1: Add their email to ADMIN_EMAILS in convex/lib/config.ts
 * Option 2: Use Better Auth's admin plugin (requires additional setup)
 */

import { query } from './_generated/server'
import { authComponent } from './auth'
import { ADMIN_EMAILS, ROLES } from './lib/config'
import type { AuthUser } from './lib/authHelpers'

/**
 * Get the current authenticated user.
 *
 * @returns The user object or null if not authenticated
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})

/**
 * Check if the current user is an admin.
 *
 * Admin status is determined by:
 * 1. Email whitelist (ADMIN_EMAILS in lib/config.ts)
 * 2. Role field on user record (role === 'admin')
 *
 * @returns true if user is an admin, false otherwise
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as AuthUser | null
    if (!user) {
      return false
    }

    // Check email whitelist first (for easy setup)
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      return true
    }

    // Fallback: check role field in database
    return user.role === ROLES.ADMIN
  },
})
