import { createRootRouteWithContext, useRouteContext } from '@tanstack/react-router'
import { Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { AuthClient } from '@convex-dev/better-auth/react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ImpersonateProvider } from '@/hooks/use-impersonate'
import { AdminToolbar } from '@/components/AdminToolbar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { authClient } from '@/lib/auth-client'
import { getToken } from '@/lib/auth-server'
import type { QueryClient } from '@tanstack/react-query'
import type { ConvexQueryClient } from '@convex-dev/react-query'

import '../styles/globals.css'

// Get auth information for SSR using available cookies
const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Convex + TanStack + Cloudflare' },
      { name: 'description', content: 'Production-ready full-stack template' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
    scripts: [
      {
        // Prevent dark mode flash (FOUC) by applying theme before paint
        children: `(function(){try{var t=localStorage.getItem('theme-preference');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}}())`,
      },
    ],
  }),
  beforeLoad: async (ctx) => {
    const token = await getAuth()

    // All queries, mutations and actions through TanStack Query will be
    // authenticated during SSR if we have a valid token
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return {
      isAuthenticated: !!token,
      token,
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })

  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      // The provider's public union type cannot preserve Better Auth's plugin
      // inference, although this client includes the required Convex plugin.
      authClient={authClient as unknown as AuthClient}
      initialToken={context.token}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="min-h-screen bg-background antialiased">
          <ImpersonateProvider>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
            <ThemeToggle />
            <AdminToolbar />
            <Toaster />
          </ImpersonateProvider>
          <Scripts />
        </body>
      </html>
    </ConvexBetterAuthProvider>
  )
}
