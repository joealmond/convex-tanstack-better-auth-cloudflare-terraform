import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
// <convexkit:billing>
import { webhook as stripeWebhook } from './stripe'
// </convexkit:billing>

const http = httpRouter()

http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () =>
    Response.json({ status: 'ok', layer: 'convex', timestamp: Date.now() })
  ),
})

// <convexkit:billing>
http.route({ path: '/api/stripe/webhook', method: 'POST', handler: stripeWebhook })
// </convexkit:billing>

export default http
