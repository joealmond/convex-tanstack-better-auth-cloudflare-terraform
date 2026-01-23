import { Eye, EyeOff, Shield } from 'lucide-react'
import { useAdmin } from '@/hooks/use-admin'
import { useImpersonate } from '@/hooks/use-impersonate'

/**
 * Admin toolbar - shows at the bottom of the screen for admins.
 * Allows toggling "view as user" mode to see what regular users see.
 */
export function AdminToolbar() {
  const { isRealAdmin } = useAdmin()
  const { isViewingAsUser, toggleViewAsUser, stopViewingAsUser } = useImpersonate()

  // Only show for real admins
  if (!isRealAdmin) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-2">
      {isViewingAsUser ? (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-yellow-500/20 text-yellow-600 border border-yellow-500/50">
            <Eye className="h-3 w-3" />
            Viewing as User
          </span>
          <button
            onClick={stopViewingAsUser}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Shield className="h-3 w-3" />
            Back to Admin
          </button>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary/20 text-primary border border-primary/50">
            <Shield className="h-3 w-3" />
            Admin Mode
          </span>
          <button
            onClick={toggleViewAsUser}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            <EyeOff className="h-3 w-3" />
            View as User
          </button>
        </>
      )}
    </div>
  )
}
