/**
 * Rate Limit Configurations
 * ==========================
 * 
 * Centralized rate limit settings for the application.
 * Adjust these values based on your app's needs.
 */

/**
 * Rate limit periods (in milliseconds)
 */
export const PERIODS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const

/**
 * Standard rate limits for different operations
 */
export const RATE_LIMITS = {
  // Message operations
  SEND_MESSAGE: {
    tokens: 1,
    maxTokens: 10, // 10 messages
    period: PERIODS.MINUTE, // per minute
  },

  // File operations
  UPLOAD_FILE: {
    tokens: 1,
    maxTokens: 5, // 5 uploads
    period: PERIODS.MINUTE, // per minute
  },

  DELETE_FILE: {
    tokens: 1,
    maxTokens: 20, // 20 deletions
    period: PERIODS.MINUTE, // per minute
  },

  // API calls (general)
  API_CALL: {
    tokens: 1,
    maxTokens: 60, // 60 calls
    period: PERIODS.MINUTE, // per minute
  },

  // Auth operations
  LOGIN_ATTEMPT: {
    tokens: 1,
    maxTokens: 5, // 5 attempts
    period: PERIODS.MINUTE, // per minute
  },

  REGISTER_USER: {
    tokens: 1,
    maxTokens: 3, // 3 registrations
    period: PERIODS.HOUR, // per hour (prevent spam accounts)
  },

  // Email operations
  SEND_EMAIL: {
    tokens: 1,
    maxTokens: 10, // 10 emails
    period: PERIODS.HOUR, // per hour
  },
} as const

/**
 * Role-based multipliers
 * Premium users get higher limits
 */
export const ROLE_MULTIPLIERS = {
  user: 1, // Standard users
  premium: 5, // Premium users get 5x
  admin: 100, // Admins get 100x (effectively unlimited)
} as const

/**
 * Get rate limit config with role multiplier applied
 */
export function getRateLimitConfig(
  limitName: keyof typeof RATE_LIMITS,
  role: keyof typeof ROLE_MULTIPLIERS = 'user'
) {
  const baseLimit = RATE_LIMITS[limitName]
  const multiplier = ROLE_MULTIPLIERS[role]

  return {
    ...baseLimit,
    maxTokens: baseLimit.maxTokens * multiplier,
  }
}

/**
 * Rate limit error messages
 */
export const RATE_LIMIT_MESSAGES = {
  SEND_MESSAGE: 'Too many messages. Please wait a minute before sending more.',
  UPLOAD_FILE: 'Too many file uploads. Please wait a minute before uploading more.',
  DELETE_FILE: 'Too many deletions. Please slow down.',
  API_CALL: 'Too many requests. Please wait a minute.',
  LOGIN_ATTEMPT: 'Too many login attempts. Please wait a minute.',
  REGISTER_USER: 'Too many registration att empts. Please try again later.',
  SEND_EMAIL: 'Too many emails sent. Please wait before sending more.',
} as const
