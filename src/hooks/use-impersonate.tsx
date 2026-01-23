/**
 * Impersonation Context & Hook
 * ============================
 *
 * Allows admins to "View as User" - temporarily hide admin features
 * to see the app as a regular user would experience it.
 *
 * ## Setup
 *
 * Wrap your app with `ImpersonateProvider` (already done in __root.tsx):
 *
 * ```tsx
 * <ImpersonateProvider>
 *   <App />
 * </ImpersonateProvider>
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * import { useImpersonate } from '@/hooks/use-impersonate'
 *
 * function AdminControls() {
 *   const { isViewingAsUser, toggleViewAsUser } = useImpersonate()
 *
 *   return (
 *     <button onClick={toggleViewAsUser}>
 *       {isViewingAsUser ? 'Back to Admin' : 'View as User'}
 *     </button>
 *   )
 * }
 * ```
 *
 * ## Integration with useAdmin
 *
 * When `isViewingAsUser` is true, `useAdmin().isAdmin` returns false
 * (while `useAdmin().isRealAdmin` still returns true).
 */

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface ImpersonateContextType {
  /** If true, admin is viewing as a regular user */
  isViewingAsUser: boolean
  /** Start viewing as a regular user (hides admin features) */
  startViewingAsUser: () => void
  /** Stop impersonation and return to admin view */
  stopViewingAsUser: () => void
  /** Toggle between admin and user view */
  toggleViewAsUser: () => void
}

const ImpersonateContext = createContext<ImpersonateContextType | null>(null)

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const [isViewingAsUser, setIsViewingAsUser] = useState(false)

  const startViewingAsUser = useCallback(() => {
    setIsViewingAsUser(true)
  }, [])

  const stopViewingAsUser = useCallback(() => {
    setIsViewingAsUser(false)
  }, [])

  const toggleViewAsUser = useCallback(() => {
    setIsViewingAsUser((prev) => !prev)
  }, [])

  return (
    <ImpersonateContext.Provider
      value={{
        isViewingAsUser,
        startViewingAsUser,
        stopViewingAsUser,
        toggleViewAsUser,
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  )
}

export function useImpersonate(): ImpersonateContextType {
  const context = useContext(ImpersonateContext)
  if (!context) {
    // Return a default state if used outside provider
    return {
      isViewingAsUser: false,
      startViewingAsUser: () => {},
      stopViewingAsUser: () => {},
      toggleViewAsUser: () => {},
    }
  }
  return context
}
