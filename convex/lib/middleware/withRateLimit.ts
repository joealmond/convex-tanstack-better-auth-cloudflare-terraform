/**
 * Rate Limiting Middleware
 * =========================
 * 
 * Middleware decorators for applying rate limits to mutations.
 * Uses the Decorator Pattern to add rate limiting behavior.
 * 
 * Usage:
 * ```typescript
 * import { withRateLimit, withStandardRateLimit } from './lib/middleware/withRateLimit'
 * 
 * // Custom rate limit
 * export const sendMessage = mutation({
 *   args: { content: v.string() },
 *   handler: withRateLimit(
 *     async (ctx, args, userId)  => {
 *       await ctx.db.insert('messages', { content: args.content, userId })
 *     },
 *     'SEND_MESSAGE'
 *   ),
 * })
 * 
 * // Pre-configured standard limit
 * export const apiCall = mutation({
 *   handler: withStandardRateLimit(async (ctx, args, userId) => {
 *     // Your logic here
 *   }),
 * })
 * ```
 */

import type { MutationCtx } from '../_generated/server'
import { RateLimitService } from '../services/rateLimitService'
import { RATE_LIMITS, ROLE_MULTIPLIERS } from '../constants/rateLimits'
import { requireAuth, isAdmin, type AuthUser } from '../authHelpers'

/**
 * Generic rate limit decorator
 * Wraps a mutation handler with rate limiting
 */
export function withRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>,
  operation: keyof typeof RATE_LIMITS,
  options?: {
    /** Custom key function (default: user ID) */
    getKey?: (ctx: MutationCtx, args: Args, user: AuthUser) => string
    /** Custom role function (default: user.role) */
    getRole?: (user: AuthUser) => keyof typeof ROLE_MULTIPLIERS
  }
) {
  return async (ctx: MutationCtx, args: Args): Promise<Output> => {
    // Require authentication
    const user = await requireAuth(ctx)

    // Determine rate limit key and role
    const key = options?.getKey?.(ctx, args, user) ?? user._id
    const role = options?.getRole?.(user) ?? (isAdmin(user) ? 'admin' : 'user')

    // Check rate limit
    const rateLimitService = new RateLimitService(ctx)
    await rateLimitService.checkLimit(operation, key, role)

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
  return withRateLimit(handler, 'API_CALL')
}

/**
 * Strict rate limit (10 requests/min)
 * Good for expensive operations like sending messages or emails
 */
export function withStrictRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'SEND_MESSAGE')
}

/**
 * File upload rate limit (5 uploads/min)
 */
export function withFileUploadLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'UPLOAD_FILE')
}

/**
 * Auth rate limit (5 attempts/min)
 * Good for login/registration endpoints
 */
export function withAuthRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
) {
  return withRateLimit(handler, 'LOGIN_ATTEMPT')
}

/**
 * Compose multiple decorators
 * Example: Apply both rate limiting and logging
 */
export function compose<Args, Output>(
  ...decorators: Array<
    (
      handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>
    ) => (ctx: MutationCtx, args: Args) => Promise<Output>
  >
) {
  return (handler: (ctx: MutationCtx, args: Args, user: AuthUser) => Promise<Output>) => {
    return decorators.reduceRight((acc, decorator) => {
      // We need to convert back to the base handler type for composition
      return decorator(async (ctx, args, user) => {
        // Call the accumulated handler
        return await (acc as any)(ctx, args)
      })
    }, handler as any)
  }
}
