/**
 * useAdmin Hook
 * =============
 *
 * Check if the current user has admin privileges.
 * Integrates with the "View as User" impersonation feature.
 *
 * @example
 * ```tsx
 * import { useAdmin } from '@/hooks/use-admin'
 *
 * function AdminPanel() {
 *   const { isAdmin, isLoading } = useAdmin()
 *
 *   if (isLoading) return <Spinner />
 *   if (!isAdmin) return null
 *
 *   return <div>Admin-only content</div>
 * }
 * ```
 *
 * @returns
 * - `isAdmin` - true if user is admin (respects "View as User" mode)
 * - `isRealAdmin` - true if user is admin (ignores impersonation)
 * - `isLoading` - true while checking admin status
 */

import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useImpersonate } from './use-impersonate'

export function useAdmin() {
  const { data: isAdminResult, isLoading } = useQuery(convexQuery(api.users.isAdmin, {}))
  const { isViewingAsUser } = useImpersonate()

  // Real admin status from Convex
  const isRealAdmin = isAdminResult === true

  // When viewing as user, pretend not to be admin for UI purposes
  const isAdmin = isRealAdmin && !isViewingAsUser

  return {
    /** True admin status (ignores impersonation) */
    isRealAdmin,
    /** Admin status with impersonation applied */
    isAdmin,
    /** Loading state */
    isLoading,
  }
}
