import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

// The convexClient() plugin routes auth requests through the Convex
// infrastructure (WebSocket/HTTP), avoiding CORS issues entirely.
// No baseURL needed — the plugin handles routing internally.
export const authClient = createAuthClient({
  plugins: [convexClient()],
})

// Export commonly used hooks and utilities
const { signIn, signUp, signOut: _signOut, useSession } = authClient

/**
 * Sign out and reload the page to reset Convex auth state.
 *
 * Without this, signing out and back in causes authenticated Convex queries
 * to fire before auth is ready — leading to errors.
 * See: https://docs.convex.dev/auth/sessions-and-tokens
 */
export const signOut = (opts?: Parameters<typeof _signOut>[0]) =>
  _signOut({
    ...opts,
    fetchOptions: {
      ...opts?.fetchOptions,
      onSuccess: (...args) => {
        opts?.fetchOptions?.onSuccess?.(...args)
        location.reload()
      },
    },
  })

export { signIn, signUp, useSession }
