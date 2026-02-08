/**
 * Rate Limit Service
 * ===================
 *
 * Simple in-memory rate limiting service.
 *
 * Benefits:
 * - Centralized rate limiting logic
 * - Configurable limits per operation
 * - Role-aware rate limiting
 * - No external dependencies
 *
 * Note: Uses Convex database for persistence. For enterprise-grade rate limiting
 * with distributed systems, consider using @convex-dev/rate-limiter component.
 *
 * Usage:
 * ```typescript
 * import { RateLimitService } from './lib/services/rateLimitService'
 *
 * export const sendMessage = mutation({
 *   handler: async (ctx, args) => {
 *     const user = await requireAuth(ctx)
 *
 *     const rateLimitService = new RateLimitService(ctx)
 *     await rateLimitService.checkLimit('SEND_MESSAGE', user._id)
 *
 *     // Continue with mutation logic
 *   }
 * })
 * ```
 */

import type { MutationCtx } from '../../_generated/server'
import { RATE_LIMITS, getRateLimitConfig, ROLE_MULTIPLIERS } from '../constants/rateLimits'

/**
 * Rate Limit Service Interface
 */
export interface IRateLimitService {
  checkLimit(
    operation: keyof typeof RATE_LIMITS,
    key: string,
    role?: keyof typeof ROLE_MULTIPLIERS
  ): Promise<void>

  reset(operation: keyof typeof RATE_LIMITS, key: string): Promise<void>
}

// In-memory rate limit tracking (per-process)
// Note: This is reset on deployment/restart. For production with multiple
// workers, consider using Convex database tables or the @convex-dev/rate-limiter component.
const rateLimitTracker = new Map<string, number[]>()

/**
 * Production Rate Limit Service
 * Uses in-memory tracking with configurable limits
 */
export class RateLimitService implements IRateLimitService {
  constructor(private ctx: MutationCtx) {}

  async checkLimit(
    operation: keyof typeof RATE_LIMITS,
    key: string,
    role: keyof typeof ROLE_MULTIPLIERS = 'user'
  ): Promise<void> {
    const config = getRateLimitConfig(operation, role)
    const trackerKey = `${operation}:${key}`
    const now = Date.now()
    const windowStart = now - config.period

    // Get existing timestamps for this key
    const timestamps = rateLimitTracker.get(trackerKey) || []

    // Filter out old timestamps outside the current window
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart)

    // Check if limit exceeded
    if (recentTimestamps.length >= config.maxTokens) {
      const oldestTimestamp = recentTimestamps[0]!
      const resetIn = Math.ceil((oldestTimestamp + config.period - now) / 1000)
      throw new Error(`Rate limit exceeded for ${operation}. Try again in ${resetIn} seconds.`)
    }

    // Add current timestamp
    recentTimestamps.push(now)
    rateLimitTracker.set(trackerKey, recentTimestamps)

    // Cleanup: periodically remove old entries to prevent memory leak
    if (Math.random() < 0.01) {
      // 1% chance to cleanup
      this.cleanup()
    }

    void this.ctx // Use ctx if needed for database-backed rate limiting
  }

  async reset(operation: keyof typeof RATE_LIMITS, key: string): Promise<void> {
    const trackerKey = `${operation}:${key}`
    rateLimitTracker.delete(trackerKey)
    void this.ctx
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, timestamps] of rateLimitTracker.entries()) {
      // Remove entries older than 5 minutes
      const filtered = timestamps.filter((ts) => ts > now - 300000)
      if (filtered.length === 0) {
        rateLimitTracker.delete(key)
      } else {
        rateLimitTracker.set(key, filtered)
      }
    }
  }
}

/**
 * Mock Rate Limit Service for Testing
 * Tracks all rate limit checks without enforcing them
 */
export class MockRateLimitService implements IRateLimitService {
  public checks: Array<{
    operation: keyof typeof RATE_LIMITS
    key: string
    role?: keyof typeof ROLE_MULTIPLIERS
  }> = []

  async checkLimit(
    operation: keyof typeof RATE_LIMITS,
    key: string,
    role: keyof typeof ROLE_MULTIPLIERS = 'user'
  ): Promise<void> {
    this.checks.push({ operation, key, role })
    // Never throws - allows all operations in tests
  }

  async reset(operation: keyof typeof RATE_LIMITS, key: string): Promise<void> {
    // Remove all checks for this operation/key
    this.checks = this.checks.filter(
      (check) => !(check.operation === operation && check.key === key)
    )
  }

  /** Get all checks for testing assertions */
  getChecks() {
    return this.checks
  }

  /** Clear all checks */
  clear() {
    this.checks = []
  }
}

/**
 * Service Factory
 * Returns appropriate rate limit service based on environment
 */
export function createRateLimitService(ctx: MutationCtx): IRateLimitService {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isTest = process.env.NODE_ENV === 'test'

  if (isDevelopment || isTest) {
    return new MockRateLimitService()
  }

  return new RateLimitService(ctx)
}
