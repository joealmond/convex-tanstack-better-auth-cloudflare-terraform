/**
 * Auth Helpers - Role-Based Access Control (RBAC)
 * ================================================
 *
 * This module provides authentication and authorization helpers for Convex functions.
 *
 * ## Quick Start
 *
 * Prefer the custom function wrappers from `customFunctions.ts` which auto-inject
 * `ctx.user` and `ctx.userId`:
 *
 * ```ts
 * import { authMutation, adminMutation } from './lib/customFunctions'
 *
 * // Authenticated — ctx.user and ctx.userId are auto-injected
 * export const myMutation = authMutation({
 *   handler: async (ctx) => {
 *     console.log(ctx.user.email, ctx.userId)
 *   },
 * })
 *
 * // Admin only — ctx.user is guaranteed admin
 * export const adminOnly = adminMutation({
 *   handler: async (ctx) => {
 *     // Only admins reach this point
 *   },
 * })
 * ```
 *
 * For optional auth in public functions, use the helpers directly:
 *
 * ```ts
 * import { publicQuery } from './lib/customFunctions'
 * import { getAuthUserSafe } from './lib/authHelpers'
 *
 * export const optionalAuth = publicQuery({
 *   handler: async (ctx) => {
 *     const user = await getAuthUserSafe(ctx) // null if not logged in
 *   },
 * })
 * ```
 *
 * ## Admin Detection
 *
 * A user is considered an admin if:
 * 1. Their email is in the ADMIN_EMAILS whitelist (see config.ts), OR
 * 2. Their user record has `role: 'admin'` in the database
 *
 * ## Setup
 *
 * Add admin emails to `convex/lib/config.ts`:
 * ```ts
 * export const ADMIN_EMAILS = ['admin@example.com']
 * ```
 */

import { authComponent } from '../auth'
import { ADMIN_EMAILS } from './config'
import type { QueryCtx, MutationCtx } from '../_generated/server'

/** Context type for queries and mutations */
type AuthContext = QueryCtx | MutationCtx

/**
 * User type returned by Better Auth Convex adapter.
 * Extended with optional role field for RBAC.
 * Note: _id is a string because the user table is managed by the Better Auth component.
 */
export interface AuthUser {
  _id: string
  name: string
  email: string
  image?: string | null
  role?: string | null
}

/**
 * Get the authenticated user or null if not authenticated.
 *
 * @param ctx - Convex query or mutation context
 * @returns The authenticated user or null
 */
export async function getAuthUser(ctx: AuthContext): Promise<AuthUser | null> {
  const user = await authComponent.getAuthUser(ctx)
  return user as AuthUser | null
}

/**
 * Get the authenticated user without throwing.
 * Returns null on any error (important for SSR where auth may not be available).
 *
 * @param ctx - Convex query or mutation context
 * @returns The authenticated user or null
 */
export async function getAuthUserSafe(ctx: AuthContext): Promise<AuthUser | null> {
  try {
    return await getAuthUser(ctx)
  } catch {
    return null
  }
}

/**
 * Require authentication. Throws if not authenticated.
 *
 * @param ctx - Convex query or mutation context
 * @returns The authenticated user (never null)
 * @throws Error if user is not authenticated
 */
export async function requireAuth(ctx: AuthContext): Promise<AuthUser> {
  const user = await getAuthUser(ctx)
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Check if a user has admin privileges.
 *
 * Admin status is determined by:
 * 1. Email whitelist (ADMIN_EMAILS in config.ts)
 * 2. Role field on user record (role === 'admin')
 *
 * @param user - The user to check
 * @returns true if user is an admin
 */
export function isAdmin(user: AuthUser): boolean {
  // Check email whitelist first (for easy setup)
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return true
  }
  // Fallback to role field in database
  return user.role === 'admin'
}

/**
 * Require admin role. Throws if not an admin.
 *
 * @param ctx - Convex query or mutation context
 * @returns The authenticated admin user
 * @throws Error if user is not authenticated or not an admin
 */
export async function requireAdmin(ctx: AuthContext): Promise<AuthUser> {
  const user = await requireAuth(ctx)
  if (!isAdmin(user)) {
    throw new Error('Admin access required')
  }
  return user
}
