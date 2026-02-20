import { z } from 'zod'

/**
 * Environment Variable Validation
 * ================================
 *
 * Validates all required environment variables at startup using Zod.
 * Provides type-safe access and clear error messages if misconfigured.
 *
 * Usage:
 * ```typescript
 * import { env } from '@/lib/env'
 *
 * const client = new ConvexQueryClient(env.VITE_CONVEX_URL)
 * ```
 */

const envSchema = z.object({
  // Convex deployment URL (required)
  VITE_CONVEX_URL: z.string().url().describe('Convex deployment URL ending in .convex.cloud'),

  // Convex site URL for HTTP actions (required for auth)
  VITE_CONVEX_SITE_URL: z
    .string()
    .url()
    .describe('Convex site URL ending in .convex.site')
    .optional(),

  // App environment
  VITE_APP_ENV: z
    .enum(['development', 'preview', 'production'])
    .default('development')
    .describe('Application environment'),

  // Sentry DSN for error tracking (optional — omit to disable Sentry)
  VITE_SENTRY_DSN: z
    .string()
    .url()
    .describe('Sentry DSN from sentry.io → Project Settings → Client Keys')
    .optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validated environment variables
 * Throws at startup if misconfigured
 */
function getEnv(): Env {
  const parsed = envSchema.safeParse({
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  })

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    console.error('\n💡 Make sure you have a .env.local file with:')
    console.error('   VITE_CONVEX_URL=https://your-deployment.convex.cloud')
    console.error('   VITE_CONVEX_SITE_URL=https://your-deployment.convex.site')
    throw new Error('Invalid environment configuration')
  }

  return parsed.data
}

export const env = getEnv()

/** Convenience flags for environment checks */
export const isDev = env.VITE_APP_ENV === 'development'
export const isPreview = env.VITE_APP_ENV === 'preview'
export const isProd = env.VITE_APP_ENV === 'production'
