/**
 * Rate Limiting Middleware
 * =========================
 *
 * Middleware decorators for applying rate limits to mutations.
 * Uses the @convex-dev/rate-limiter component for persistent rate limiting.
 *
 * Usage:
 * ```typescript
 * import { withRateLimit } from './lib/middleware/withRateLimit'
 *
 * export const sendMessage = mutation({
 *   args: { content: v.string() },
 *   handler: withRateLimit(
 *     async (ctx, args, userId) => {
 *       await ctx.db.insert('messages', { content: args.content, userId })
 *     },
 *     'sendMessage'
 *   ),
 * })
 * ```
 */

import type { MutationCtx } from '../../_generated/server'
import { rateLimiter, type RateLimitName } from '../services/rateLimitService'
import { requireAuth, type AuthUser } from '../authHelpers'

/**
 * Generic rate limit decorator
 * Wraps a mutation handler with rate limiting
 */
export function withRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>,
  operation: RateLimitName,
  options?: {
    /** Custom key function (default: user ID) */
    getKey?: (ctx: MutationCtx, args: Args, user: AuthUser) => string
  }
) {
  return async (ctx: MutationCtx, args: Args): Promise<Output> => {
    // Require authentication
    const user = await requireAuth(ctx)

    // Determine rate limit key
    const key = options?.getKey?.(ctx, args, user) ?? user._id

    // Check rate limit using the component
    await rateLimiter.limit(ctx, operation, { key, throws: true })

    // Execute original handler
    return await handler(ctx, args, user)
  }
}

/**
 * Standard rate limit (60 requests/min)
 * Good for general API calls
 */
export function withStandardRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'apiCall')
}

/**
 * Strict rate limit (10 requests/min)
 * Good for expensive operations like sending messages or emails
 */
export function withStrictRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'sendMessage')
}

/**
 * File upload rate limit (5 uploads/min)
 */
export function withFileUploadLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'uploadFile')
}

/**
 * Auth rate limit (5 attempts/min)
 * Good for login/registration endpoints
 */
export function withAuthRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'loginAttempt')
}
