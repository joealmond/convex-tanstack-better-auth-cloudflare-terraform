import { createRouter } from '@tanstack/react-router'
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexError } from 'convex/values'
import { toast } from 'sonner'
import { routeTree } from './routeTree.gen'
import { NotFound } from './components/NotFound'
import { env } from './lib/env'
import { logger } from './lib/logger'

// =============================================================================
// Sentry Initialization (optional — only when VITE_SENTRY_DSN is set)
// =============================================================================
if (typeof window !== 'undefined' && env.VITE_SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: env.VITE_SENTRY_DSN,
        environment: env.VITE_APP_ENV,
        tracesSampleRate: env.VITE_APP_ENV === 'production' ? 0.2 : 1.0,
      })
    })
    .catch(() => {
      // @sentry/react not installed — that's fine, it's optional
    })
}

export function getRouter() {
  const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Log query errors silently (no toast — avoids spam from background refetches)
        logger.error('Query error', error, {
          queryKey: query.queryKey as unknown as Record<string, unknown>,
        })
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, _context, mutation) => {
        // Log + show toast for mutation failures (user-initiated actions)
        logger.error('Mutation error', error, {
          mutationKey: mutation.options.mutationKey as unknown as Record<string, unknown>,
          variables: variables as Record<string, unknown>,
        })

        // Extract user-friendly message from ConvexError or fall back to generic
        const errorMessage =
          error instanceof ConvexError
            ? String(error.data)
            : error instanceof Error
              ? error.message
              : 'An unexpected error occurred'

        if (typeof window !== 'undefined') {
          toast.error('Action Failed', { description: errorMessage })
        }
      },
    }),
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
