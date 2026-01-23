import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { env } from './env'

// Server-side auth utilities for SSR
export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL ?? env.VITE_CONVEX_URL.replace('.cloud', '.site'),
})
