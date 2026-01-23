import { createRouter } from '@tanstack/react-router'
import { QueryClient, MutationCache } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { routeTree } from './routeTree.gen'
import { env } from './lib/env'

export function getRouter() {
  const convexClient = new ConvexReactClient(env.VITE_CONVEX_URL)
  const convexQueryClient = new ConvexQueryClient(convexClient)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        // Cache settings
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    }),
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient },
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexClient}>
        {children}
      </ConvexProvider>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
