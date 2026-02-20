/**
 * Custom Convex Function Wrappers
 * ================================
 *
 * Type-safe function builders with built-in auth and global error handling.
 * Uses `convex-helpers/server/customFunctions` to eliminate repetitive auth
 * boilerplate and ensure all errors are normalized to `ConvexError`.
 *
 * ## Function Types
 *
 * | Wrapper           | Auth          | Use Case                          |
 * | ----------------- | ------------- | --------------------------------- |
 * | `publicQuery`     | None          | Public reads, SSR loaders         |
 * | `publicMutation`  | None          | Anonymous writes (e.g. guest msg) |
 * | `publicAction`    | None          | Public HTTP-triggered actions      |
 * | `authQuery`       | Required      | Authenticated reads               |
 * | `authMutation`    | Required      | Authenticated writes              |
 * | `adminQuery`      | Admin only    | Admin dashboards                  |
 * | `adminMutation`   | Admin only    | Admin operations                  |
 * | `internalQuery`   | None (callee) | Internal reads (crons, actions)   |
 * | `internalMutation`| None (callee) | Internal writes (side effects)    |
 * | `internalAction`  | None (callee) | Internal actions (external APIs)  |
 *
 * ## Usage
 *
 * ```ts
 * import { authMutation, publicQuery } from './lib/customFunctions'
 *
 * // ctx.user and ctx.userId are automatically injected
 * export const create = authMutation({
 *   args: { name: v.string() },
 *   handler: async (ctx, args) => {
 *     return await ctx.db.insert('items', { name: args.name, userId: ctx.userId })
 *   },
 * })
 *
 * // Public queries have no auth — errors are still caught globally
 * export const list = publicQuery({
 *   args: {},
 *   handler: async (ctx) => {
 *     return await ctx.db.query('items').collect()
 *   },
 * })
 * ```
 *
 * ## Error Handling
 *
 * All wrappers pass through `handleServerError()` which:
 * 1. Logs the error with a context label (visible in Convex dashboard logs)
 * 2. Re-throws `ConvexError` instances as-is (preserves client-readable messages)
 * 3. Wraps raw `Error` in `ConvexError` for safe client transport
 */

import { customQuery, customMutation, customAction } from 'convex-helpers/server/customFunctions'
import {
  query,
  mutation,
  action,
  internalQuery as rawInternalQuery,
  internalMutation as rawInternalMutation,
  internalAction as rawInternalAction,
} from '../_generated/server'
import { requireAuth, requireAdmin } from './authHelpers'
import { ConvexError } from 'convex/values'

// =============================================================================
// Global Exception Filter
// =============================================================================

/**
 * Normalize any thrown error into a `ConvexError` for safe client consumption.
 * Already-wrapped `ConvexError` instances are re-thrown as-is.
 */
function handleServerError(error: unknown, context: string): never {
  console.error(`[Exception in ${context}]:`, error)

  if (error instanceof ConvexError) {
    throw error
  }

  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  throw new ConvexError(message)
}

// =============================================================================
// Authenticated Function Wrappers
// =============================================================================

/**
 * Query that requires authentication.
 * Injects `ctx.user` (AuthUser) and `ctx.userId` (string).
 */
export const authQuery = customQuery(query, {
  args: {},
  input: async (ctx, _args) => {
    try {
      const user = await requireAuth(ctx)
      return { ctx: { ...ctx, user, userId: user._id }, args: {} }
    } catch (e) {
      handleServerError(e, 'authQuery')
    }
  },
})

/**
 * Mutation that requires authentication.
 * Injects `ctx.user` (AuthUser) and `ctx.userId` (string).
 */
export const authMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, _args) => {
    try {
      const user = await requireAuth(ctx)
      return { ctx: { ...ctx, user, userId: user._id }, args: {} }
    } catch (e) {
      handleServerError(e, 'authMutation')
    }
  },
})

// =============================================================================
// Admin Function Wrappers
// =============================================================================

/**
 * Query that requires admin privileges.
 * Injects `ctx.user` (AuthUser) and `ctx.userId` (string).
 */
export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx, _args) => {
    try {
      const user = await requireAdmin(ctx)
      return { ctx: { ...ctx, user, userId: user._id }, args: {} }
    } catch (e) {
      handleServerError(e, 'adminQuery')
    }
  },
})

/**
 * Mutation that requires admin privileges.
 * Injects `ctx.user` (AuthUser) and `ctx.userId` (string).
 */
export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, _args) => {
    try {
      const user = await requireAdmin(ctx)
      return { ctx: { ...ctx, user, userId: user._id }, args: {} }
    } catch (e) {
      handleServerError(e, 'adminMutation')
    }
  },
})

// =============================================================================
// Public Function Wrappers (no auth, but still globally error-handled)
// =============================================================================

/** Public query — no auth required, global error handling. */
export const publicQuery = customQuery(query, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})

/** Public mutation — no auth required, global error handling. */
export const publicMutation = customMutation(mutation, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})

/** Public action — no auth required, global error handling. */
export const publicAction = customAction(action, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})

// =============================================================================
// Internal Function Wrappers (not exposed via API, called by scheduler/crons)
// =============================================================================

/** Internal query — not exposed in public API. */
export const internalQuery = customQuery(rawInternalQuery, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})

/** Internal mutation — not exposed in public API. */
export const internalMutation = customMutation(rawInternalMutation, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})

/** Internal action — not exposed in public API. */
export const internalAction = customAction(rawInternalAction, {
  args: {},
  input: async (_ctx, _args) => {
    return { ctx: {}, args: {} }
  },
})
