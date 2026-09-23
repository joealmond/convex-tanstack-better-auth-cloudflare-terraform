import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components, internal } from './_generated/api'
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
  const authEmailProvider = process.env.AUTH_EMAIL_PROVIDER || 'disabled'
  if (!['disabled', 'resend'].includes(authEmailProvider))
    throw new Error('AUTH_EMAIL_PROVIDER must be disabled or resend')
  if (
    authEmailProvider === 'resend' &&
    (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM)
  )
    throw new Error('AUTH_EMAIL_PROVIDER=resend requires RESEND_API_KEY and AUTH_EMAIL_FROM')

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
    authEmailEnabled: authEmailProvider === 'resend',
  }
}

// Get env config (warns if missing, uses placeholders to allow push)
const envConfig = getEnvConfig()

// Component client for Convex + Better Auth integration
export const authComponent = createClient<DataModel>(components.betterAuth)

// Create Better Auth instance with Convex adapter
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const sendAuthEmail = async (kind: 'verify' | 'reset' | 'delete', to: string, url: string) => {
    if (!('runAction' in ctx)) throw new Error('Account email requires an HTTP action context')
    await ctx.runAction(internal.authEmails.send, { kind, to, url })
  }
  return betterAuth({
    baseURL: envConfig.siteUrl,
    trustedOrigins: [envConfig.siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: envConfig.authEmailEnabled,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: envConfig.authEmailEnabled
        ? ({ user, url }) => sendAuthEmail('reset', user.email, url)
        : undefined,
    },
    emailVerification: envConfig.authEmailEnabled
      ? {
          sendVerificationEmail: ({ user, url }) => sendAuthEmail('verify', user.email, url),
          sendOnSignUp: true,
          sendOnSignIn: true,
          autoSignInAfterVerification: true,
          expiresIn: 60 * 60,
        }
      : undefined,
    user: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: envConfig.authEmailEnabled
          ? ({ user, url }) => sendAuthEmail('delete', user.email, url)
          : undefined,
        deleteTokenExpiresIn: 60 * 60,
        afterDelete: async (user) => {
          if ('scheduler' in ctx) {
            await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, {
              userId: user.id,
              email: user.email,
            })
          }
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 600, max: 5 },
        '/request-password-reset': { window: 600, max: 5 },
        '/send-verification-email': { window: 600, max: 5 },
        '/delete-user': { window: 600, max: 3 },
      },
    },
    // <convexkit:email>
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if ('scheduler' in ctx) {
              await ctx.scheduler.runAfter(0, internal.emails.enqueueWelcome, {
                ownerId: user.id,
                to: user.email,
                name: user.name,
              })
            }
          },
        },
      },
    },
    // </convexkit:email>
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },
    },
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
