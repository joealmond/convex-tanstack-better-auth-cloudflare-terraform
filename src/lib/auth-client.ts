import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [convexClient()],
})

// Export commonly used hooks and utilities
export const {
  signIn,
  signOut,
  useSession,
} = authClient
