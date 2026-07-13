import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { Toaster } from 'sonner'
import type { QueryClient } from '@tanstack/react-query'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ImpersonateProvider } from '@/hooks/use-impersonate'
import { AdminToolbar } from '@/components/AdminToolbar'
import { ThemeToggle } from '@/components/ThemeToggle'
import '../styles/globals.css'

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId, getToken } = await auth()
  return { userId, token: await getToken() }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ConvexKit' },
      { name: 'description', content: 'Production-ready realtime full-stack starter' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchClerkAuth()
    if (token) ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    return { isAuthenticated: Boolean(userId), token }
  },
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })
  return (
    <ClerkProvider appearance={{ cssLayerName: 'clerk' }}>
      <ConvexProviderWithClerk client={context.convexQueryClient.convexClient} useAuth={useAuth}>
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
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
