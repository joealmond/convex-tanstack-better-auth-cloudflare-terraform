import { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ImpersonateProvider } from '@/hooks/use-impersonate'
import { AdminToolbar } from '@/components/AdminToolbar'

import '../styles/globals.css'

// Root route context type
interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Convex + TanStack + Cloudflare' },
      { name: 'description', content: 'Production-ready full-stack template' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ImpersonateProvider>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
          <AdminToolbar />
        </ImpersonateProvider>
        <Scripts />
      </body>
    </html>
  )
}
