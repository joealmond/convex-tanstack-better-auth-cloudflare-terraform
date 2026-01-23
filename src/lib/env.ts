import { z } from 'zod'

// Environment schema - validates all required env vars
const envSchema = z.object({
  VITE_CONVEX_URL: z.string().url(),
  VITE_CONVEX_SITE_URL: z.string().url().optional(),
  VITE_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
})

// Type for validated environment
export type Env = z.infer<typeof envSchema>

// Validate and export environment
function getEnv(): Env {
  const parsed = envSchema.safeParse({
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  })

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration')
  }

  return parsed.data
}

export const env = getEnv()

// Helper to check environment
export const isDev = env.VITE_APP_ENV === 'development'
export const isPreview = env.VITE_APP_ENV === 'preview'
export const isProd = env.VITE_APP_ENV === 'production'
