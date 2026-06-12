import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useAdmin } from '@/hooks/use-admin'
import { useImpersonate } from '@/hooks/use-impersonate'
import { Shield, User, EyeOff, Eye, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type AdminRbacExampleProps = {
  backTo?: '/' | '/examples'
}

export function AdminRbacExample({ backTo = '/' }: AdminRbacExampleProps) {
  const { data: user, isLoading: isUserLoading } = useQuery(convexQuery(api.users.current, {}))
  const { isAdmin, isRealAdmin, isLoading: isAdminLoading } = useAdmin()
  const { isViewingAsUser, toggleViewAsUser, stopViewingAsUser } = useImpersonate()

  const isLoading = isUserLoading || isAdminLoading

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">ConvexKit example</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Admin / RBAC
            </h1>
          </div>
          <Link
            to={backTo}
            className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={User}
            label="Session"
            value={isLoading ? 'Checking...' : user ? user.email : 'Anonymous'}
          />
          <StatusCard
            icon={Shield}
            label="Effective Role"
            value={isLoading ? 'Checking...' : isAdmin ? 'Admin' : 'User'}
          />
          <StatusCard
            icon={Eye}
            label="Impersonation"
            value={isViewingAsUser ? 'Viewing as user' : 'Normal view'}
          />
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Admin Controls</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Admin status comes from the email whitelist in{' '}
                <code className="text-primary">convex/lib/config.ts</code> or a user role. Real
                admins can toggle the global toolbar into a regular-user view.
              </p>
            </div>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={toggleViewAsUser}
              disabled={!isRealAdmin}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <EyeOff className="h-4 w-4" />
              {isViewingAsUser ? 'Return to admin view' : 'View as user'}
            </button>
            <button
              onClick={stopViewingAsUser}
              disabled={!isViewingAsUser}
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              Stop impersonation
            </button>
          </div>

          {!isRealAdmin && (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Sign in with an email listed in <code className="text-primary">ADMIN_EMAILS</code> to
              activate admin-only controls.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </div>
  )
}
