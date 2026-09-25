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
 * Option 1: Add their verified email to ADMIN_EMAILS in convex/lib/config.ts
 * Option 2: Use Better Auth's admin plugin (requires additional setup)
 */

import { internal } from './_generated/api'
import { v } from 'convex/values'
import { Effect } from 'effect'
import { authAction, authMutation, internalMutation, publicQuery } from './lib/customFunctions'
import { getAuthUserSafe, isAdmin as checkIsAdmin } from './lib/authHelpers'
import { runEffect } from './lib/runEffect'

/**
 * Get the current authenticated user.
 *
 * @returns The user object or null if not authenticated
 */
export const current = publicQuery({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserSafe(ctx)
  },
})

/**
 * Check if the current user is an admin.
 *
 * Admin status is determined by:
 * 1. Verified email allowlist (ADMIN_EMAILS in lib/config.ts)
 * 2. Role field on user record (role === 'admin')
 *
 * @returns true if user is an admin, false otherwise
 */
export const isAdmin = publicQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx)
    if (!user) return false
    return checkIsAdmin(user)
  },
})

/** Remove application data for an authenticated account on request. */
export const requestAccountDataDeletion = authMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, {
      userId: ctx.userId,
    })
  },
})

export const queueAccountCleanup = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, args)
  },
})

/** Guard provider obligations, then queue application cleanup before Clerk deletes identity. */
export const prepareAccountDeletion = authAction({
  args: {},
  handler: (ctx): Promise<void> =>
    runEffect(
      Effect.gen(function* () {
        // <convexkit:billing>
        yield* Effect.tryPromise({
          try: () =>
            ctx.runAction(internal.stripe.assertNoProviderObligations, { ownerId: ctx.userId }),
          catch: (error) => error,
        })
        yield* Effect.tryPromise({
          try: () =>
            ctx.runQuery(internal.billing.assertAccountDeletionAllowed, { ownerId: ctx.userId }),
          catch: (error) => error,
        })
        yield* Effect.tryPromise({
          try: () =>
            ctx.runMutation(internal.billing.prepareAccountDeletion, { ownerId: ctx.userId }),
          catch: (error) => error,
        })
        // </convexkit:billing>
        yield* Effect.tryPromise({
          try: () =>
            ctx.runMutation(internal.users.queueAccountCleanup, {
              userId: ctx.userId,
              email: ctx.user.emailVerified ? ctx.user.email : undefined,
            }),
          catch: (error) => error,
        })
      })
    ),
})
