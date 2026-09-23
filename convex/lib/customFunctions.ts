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
 * All wrappers catch authentication and handler errors with `handleServerError()` which:
 * 1. Logs the error with a context label (visible in Convex dashboard logs)
 * 2. Re-throws `ConvexError` instances as-is (preserves client-readable messages)
 * 3. Logs unexpected errors server-side and returns an opaque error ID to clients
 * Argument/return validation is still handled by Convex itself.
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
import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'

// =============================================================================
// Global Exception Filter
// =============================================================================

/**
 * Normalize any thrown error into a `ConvexError` for safe client consumption.
 * Already-wrapped `ConvexError` instances are re-thrown as-is.
 */
function handleServerError(error: unknown, context: string): never {
  if (error instanceof ConvexError) {
    throw error
  }

  const errorId = crypto.randomUUID()
  console.error(
    JSON.stringify({
      event: 'unhandled_convex_error',
      errorId,
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  )
  throw new ConvexError({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    errorId,
  })
}

/**
 * Wrap the application handler. Custom-function input runs before it, so
 * authentication inputs catch their own errors below.
 */
type Handler = (...args: unknown[]) => unknown
type Definition = Handler | { handler: Handler; [key: string]: unknown }

function withErrorHandling<Builder extends (definition: never) => unknown>(
  builder: Builder,
  context: string
): Builder {
  const wrapped = (definition: Definition) => {
    const handler = typeof definition === 'function' ? definition : definition.handler
    return Reflect.apply(builder, undefined, [
      {
        ...(typeof definition === 'function' ? {} : definition),
        handler: async (...args: unknown[]) => {
          try {
            return await handler(...args)
          } catch (error) {
            handleServerError(error, context)
          }
        },
      },
    ])
  }
  // Keep the original generic builder signature, validators, visibility and
  // inferred arguments/return types. Only handler execution is decorated.
  return wrapped as unknown as Builder
}

async function authenticated(ctx: QueryCtx | MutationCtx | ActionCtx) {
  try {
    const user = await requireAuth(ctx)
    return { ctx: { user, userId: user._id }, args: {} }
  } catch (error) {
    handleServerError(error, 'authentication')
  }
}

async function administrator(ctx: QueryCtx | MutationCtx | ActionCtx) {
  try {
    const user = await requireAdmin(ctx)
    return { ctx: { user, userId: user._id }, args: {} }
  } catch (error) {
    handleServerError(error, 'administration')
  }
}

export const authQuery = customQuery(withErrorHandling(query, 'authQuery'), {
  args: {},
  input: authenticated,
})
export const authMutation = customMutation(withErrorHandling(mutation, 'authMutation'), {
  args: {},
  input: authenticated,
})
export const authAction = customAction(withErrorHandling(action, 'authAction'), {
  args: {},
  input: authenticated,
})
export const adminQuery = customQuery(withErrorHandling(query, 'adminQuery'), {
  args: {},
  input: administrator,
})
export const adminMutation = customMutation(withErrorHandling(mutation, 'adminMutation'), {
  args: {},
  input: administrator,
})

export const publicQuery = withErrorHandling(query, 'publicQuery')
export const publicMutation = withErrorHandling(mutation, 'publicMutation')
export const publicAction = withErrorHandling(action, 'publicAction')
export const internalQuery = withErrorHandling(rawInternalQuery, 'internalQuery')
export const internalMutation = withErrorHandling(rawInternalMutation, 'internalMutation')
export const internalAction = withErrorHandling(rawInternalAction, 'internalAction')
