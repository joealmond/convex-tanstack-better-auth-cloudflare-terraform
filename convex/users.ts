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
import { ConvexError, v } from 'convex/values'
// <convexkit:billing>
import { Effect } from 'effect'
import { runEffect } from './lib/runEffect'
// </convexkit:billing>
import { authAction, authMutation, internalMutation, publicQuery } from './lib/customFunctions'
import { getAuthUserSafe, isAdmin as checkIsAdmin } from './lib/authHelpers'

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

/** Called only by a trusted identity-provider deletion webhook. */
export const confirmAccountDeletion = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { userId, email }) => {
    // <convexkit:billing>
    await ctx.runMutation(internal.billing.prepareAccountDeletion, { ownerId: userId })
    // </convexkit:billing>
    await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, { userId, email })
  },
})

/** Reserve the delete boundary; trusted provider confirmation performs cleanup. */
export const prepareAccountDeletion = authAction({
  args: {},
  handler: async (_ctx): Promise<void> => {
    if (process.env.CLERK_JWT_ISSUER_DOMAIN && !process.env.CLERK_WEBHOOK_SECRET)
      throw new ConvexError('Configure the Clerk deletion webhook before deleting an account')
    // <convexkit:billing>
    await _ctx.runMutation(internal.billing.beginAccountDeletion, { ownerId: _ctx.userId })
    try {
      await runEffect(
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () =>
              _ctx.runAction(internal.stripe.assertNoProviderObligations, { ownerId: _ctx.userId }),
            catch: (error) => error,
          })
          yield* Effect.tryPromise({
            try: () =>
              _ctx.runQuery(internal.billing.assertAccountDeletionAllowed, {
                ownerId: _ctx.userId,
              }),
            catch: (error) => error,
          })
        })
      )
    } catch (error) {
      await _ctx.runMutation(internal.billing.abandonAccountDeletion, { ownerId: _ctx.userId })
      throw error
    }
    // </convexkit:billing>
  },
})
