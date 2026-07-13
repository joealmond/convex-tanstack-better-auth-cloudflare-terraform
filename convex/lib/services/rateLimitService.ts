/**
 * Rate Limit Service
 * ===================
 *
 * Uses the @convex-dev/rate-limiter component for persistent, distributed
 * rate limiting across all Convex function invocations.
 *
 * The in-memory approach (Map) is broken for Convex because state doesn't
 * persist across function invocations. This component stores rate limit
 * state in the Convex database.
 *
 * Usage:
 * ```typescript
 * import { rateLimiter } from './lib/services/rateLimitService'
 *
 * export const sendMessage = mutation({
 *   handler: async (ctx, args) => {
 *     const user = await requireAuth(ctx)
 *     await rateLimiter.limit(ctx, 'sendMessage', { key: user._id })
 *     // Continue with mutation logic
 *   }
 * })
 * ```
 */

import { RateLimiter } from '@convex-dev/rate-limiter'
import { components } from '../../_generated/api'

/**
 * Rate limiter instance with predefined limits per operation.
 *
 * Uses token bucket algorithm:
 * - `rate`: tokens added per `period`
 * - `capacity`: max burst size
 * - `period`: refill window in ms
 *
 * Throws ConvexError when limit exceeded.
 */
/**
 * Predefined rate limit configurations.
 * Exported so middleware can pass config explicitly (needed for TS overload resolution).
 */
export const RATE_LIMIT_DEFS = {
  // Message operations: 10 messages per minute, burst up to 15
  sendMessage: { kind: 'token bucket' as const, rate: 10, period: 60_000, capacity: 15 },

  // Safety valve for anonymous identifier rotation and unexpected traffic spikes.
  sendMessageGlobal: {
    kind: 'token bucket' as const,
    rate: 300,
    period: 60_000,
    capacity: 450,
    shards: 10,
  },

  // File operations: 5 uploads per minute
  uploadFile: { kind: 'token bucket' as const, rate: 5, period: 60_000, capacity: 10 },

  // File deletion: 20 per minute
  deleteFile: { kind: 'token bucket' as const, rate: 20, period: 60_000, capacity: 25 },

  // General API: 60 per minute
  apiCall: { kind: 'token bucket' as const, rate: 60, period: 60_000, capacity: 80 },

  // Auth: 5 login attempts per minute
  loginAttempt: { kind: 'token bucket' as const, rate: 5, period: 60_000, capacity: 5 },

  // Registration: 3 per hour
  registerUser: { kind: 'token bucket' as const, rate: 3, period: 3_600_000, capacity: 3 },

  // Email: 10 per hour
  sendEmail: { kind: 'token bucket' as const, rate: 10, period: 3_600_000, capacity: 10 },
}

export type RateLimitName = keyof typeof RATE_LIMIT_DEFS

export const rateLimiter = new RateLimiter(components.rateLimiter, RATE_LIMIT_DEFS)
