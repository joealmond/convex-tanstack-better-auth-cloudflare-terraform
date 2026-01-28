/**
 * Route Guards Pattern
 * =====================
 * 
 * Declarative authentication and authorization guards for routes.
 * 
 * Benefits:
 * - Declarative auth checks
 * - Reusable across routes
 * - Consistent redirect behavior
 * - Easy to test
 * 
 * Usage:
 * ```typescript
 * import { RequireAuth, RequireAdmin } from '@/lib/patterns/RouteGuards'
 * 
 * export const Route = createFileRoute('/dashboard')({
 *   component: () => (
 *     <RequireAuth>
 *       <DashboardPage />
 *     </RequireAuth>
 *   ),
 * })
 * ```
 */

import { Navigate, useRouter } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'
import type { ReactNode } from 'react'

/**
 * Require Authentication Guard
 * Redirects to login if user is not authenticated
 */
export function RequireAuth({
  children,
  redirectTo = '/login',
  fallback,
}: {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  if (isPending) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session?.user) {
    // Store intended destination for redirect after login
    const currentPath = router.state.location.pathname
    return <Navigate to={redirectTo} search={{ redirect: currentPath }} />
  }

  return <>{children}</>
}

/**
 * Require Admin Role Guard
 * Redirects to home if user is not an admin
 */
export function RequireAdmin({
  children,
  redirectTo = '/',
  fallback,
}: {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  // Check if user has admin role
  const isAdmin = session.user.role === 'admin'
  if (!isAdmin) {
    return <Navigate to={redirectTo} />
  }

  return <>{children}</>
}

/**
 * Require Specific Role Guard
 * Generic guard for any role
 */
export function RequireRole({
  children,
  role,
  redirectTo = '/',
  fallback,
}: {
  children: ReactNode
  role: string | string[]
  redirectTo?: string
  fallback?: ReactNode
}) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  const allowedRoles = Array.isArray(role) ? role : [role]
  const hasRole = session.user.role && allowedRoles.includes(session.user.role)

  if (!hasRole) {
    return <Navigate to={redirectTo} />
  }

  return <>{children}</>
}

/**
 * Require Guest Guard (logged-out users only)
 * Useful for login/register pages
 */
export function RequireGuest({
  children,
  redirectTo = '/',
}: {
  children: ReactNode
  redirectTo?: string
}) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (session?.user) {
    return <Navigate to={redirectTo} />
  }

  return <>{children}</>
}

/**
 * Feature Flag Guard
 * Show content only if feature flag is enabled
 */
import { useQuery } from 'convex/react'

export function RequireFeature({
  children,
  feature,
  fallback = null,
}: {
  children: ReactNode
  feature: string
  fallback?: ReactNode
}) {
  // You would implement a feature flag query in Convex
  // const flags = useQuery(api.features.getFlags)
  // const isEnabled = flags?.[feature] ?? false

  // For now, we'll just use an environment variable
  const isEnabled = import.meta.env[`VITE_FEATURE_${feature.toUpperCase()}`] === 'true'

  if (!isEnabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Subscription Guard
 * Require active subscription
 */
export function RequireSubscription({
  children,
  redirectTo = '/pricing',
  fallback,
}: {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}) {
  const { data: session, isPending } = useSession()
  // const subscription = useQuery(api.subscriptions.getMySubscription)

  if (isPending) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  // Check subscription status
  // const hasActiveSubscription = subscription?.status === 'active'
  const hasActiveSubscription = false // Placeholder

  if (!hasActiveSubscription) {
    return <Navigate to={redirectTo} />
  }

  return <>{children}</>
}

/**
 * Combined Guard Composer
 * Combine multiple guards
 */
export function ComposeGuards({
  children,
  guards,
}: {
  children: ReactNode
  guards: Array<(props: { children: ReactNode }) => JSX.Element>
}) {
  return guards.reduceRight((acc, Guard) => <Guard>{acc}</Guard>, <>{children}</>)
}

/**
 * Example Usage:
 * 
 * // Simple auth guard
 * <RequireAuth>
 *   <ProtectedPage />
 * </RequireAuth>
 * 
 * // Admin only
 * <RequireAdmin>
 *   <AdminPanel />
 * </RequireAdmin>
 * 
 * // Multiple guards
 * <ComposeGuards guards={[RequireAuth, RequireAdmin, RequireSubscription]}>
 *   <PremiumAdminFeature />
 * </ComposeGuards>
 * 
 * // Feature flag
 * <RequireFeature feature="NEW_DASHBOARD" fallback={<OldDashboard />}>
 *   <NewDashboard />
 * </RequireFeature>
 */
