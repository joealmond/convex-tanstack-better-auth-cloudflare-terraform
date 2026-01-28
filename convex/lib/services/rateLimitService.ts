/**
 * Rate Limit Service
 * ===================
 * 
 * Service Adapter for rate limiting using @convex-dev/rate-limiter.
 * 
 * Benefits:
 * - Centralized rate limiting logic
 * - Easy to test with mock
 * - Configurable limits per operation
 * - Role-aware rate limiting
 * 
 * Usage:
 * ```typescript
 * import { RateLimitService } from './lib/services/rateLimitService'
 * 
 * export const sendMessage = mutation({
 *   handler: async (ctx, args) => {
 *     const userId = await requireAuth(ctx)
 *     
 *     const rateLimitService = new RateLimitService(ctx)
 *     await rateLimitService.checkLimit('SEND_MESSAGE', userId)
 *     
 *     // Continue with mutation logic
 *   }
 * })
 * ```
 */

import type { MutationCtx } from '../_generated/server'
import { RATE_LIMITS, RATE_LIMIT_MESSAGES, getRateLimitConfig, ROLE_MULTIPLIERS } from '../constants/rateLimits'

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

/**
 * Production Rate Limit Service
 * Uses @convex-dev/rate-limiter component
 */
export class RateLimitService implements IRateLimitService {
  constructor(private ctx: MutationCtx) {}

  async checkLimit(
    operation: keyof typeof RATE_LIMITS,
    key: string,
    role: keyof typeof ROLE_MULTIPLIERS = 'user'
  ): Promise<void> {
    const config = getRateLimitConfig(operation, role)
    
    // TODO: Uncomment when @convex-dev/rate-limiter is properly configured
    // For now, we'll use a simple in-memory check
    
    /*
    const { rateLimiter } = useComponents()
    
    const { ok } = await rateLimiter.limit(this.ctx, operation, {
      key,
      tokens: config.tokens,
      maxTokens: config.maxTokens,
      period: config.period,
    })
    
    if (!ok) {
      throw new Error(RATE_LIMIT_MESSAGES[operation])
    }
    */
    
    // Simplified version without component (for now)
    console.log(`[RATE LIMIT] ${operation} for key ${key} (role: ${role})`)
    
    // TODO: Implement actual rate limiting once component is configured
    // For now, this is a placeholder that logs the attempt
  }

  async reset(operation: keyof typeof RATE_LIMITS, key: string): Promise<void> {
    // TODO: Uncomment when @convex-dev/rate-limiter is properly configured
    /*
    const { rateLimiter } = useComponents()
    await rateLimiter.reset(this.ctx, operation, { key })
    */
    
    console.log(`[RATE LIMIT] Reset ${operation} for key ${key}`)
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
