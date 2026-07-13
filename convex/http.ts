import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { authComponent, createAuth } from './auth'
// <convexkit:billing>
import { webhook as stripeWebhook } from './stripe'
// </convexkit:billing>

const http = httpRouter()

// Health check endpoint for monitoring
http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: 'ok',
        layer: 'convex',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }),
})

// Register Better Auth routes
authComponent.registerRoutes(http, createAuth)

// <convexkit:billing>
http.route({ path: '/api/stripe/webhook', method: 'POST', handler: stripeWebhook })
// </convexkit:billing>

export default http
