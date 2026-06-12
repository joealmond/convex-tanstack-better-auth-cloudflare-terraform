import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components } from './_generated/api'
import { query } from './_generated/server'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

// =============================================================================
// Environment Variable Helpers
// =============================================================================

const REQUIRED_ENV_VARS = ['SITE_URL'] as const

/**
 * Check for missing env vars and log a helpful warning.
 * Google OAuth is optional so anonymous demo features work out of the box.
 */
function getEnvConfig() {
  const siteUrl = process.env.SITE_URL
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name])

  if (missing.length > 0) {
    console.warn(
      `⚠️  MISSING CONVEX ENV VARS: ${missing.join(', ')}. Set with: npx convex env set <VAR> "value" or use Convex Dashboard → Settings → Environment Variables`
    )
  }

  const hasGoogleConfig = Boolean(googleClientId && googleClientSecret)
  if (!hasGoogleConfig) {
    console.warn('ℹ️  Google OAuth is not configured. Anonymous demo features remain available.')
  }

  return {
    siteUrl: siteUrl || 'https://placeholder.convex.site',
    googleClientId,
    googleClientSecret,
    hasGoogleConfig,
  }
}

// Get env config (warns if missing, uses placeholders to allow push)
const envConfig = getEnvConfig()

// Component client for Convex + Better Auth integration
export const authComponent = createClient<DataModel>(components.betterAuth)

// Create Better Auth instance with Convex adapter
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: envConfig.siteUrl,
    database: authComponent.adapter(ctx),
    socialProviders: envConfig.hasGoogleConfig
      ? {
          google: {
            clientId: envConfig.googleClientId!,
            clientSecret: envConfig.googleClientSecret!,
          },
        }
      : {},
    plugins: [convex({ authConfig })],
  })
}

// Query to get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
