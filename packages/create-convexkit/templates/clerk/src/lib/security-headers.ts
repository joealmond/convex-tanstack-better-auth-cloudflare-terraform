const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.sentry.io https://*.clerk.com https://*.clerk.accounts.dev wss://*.clerk.com",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev",
  "img-src 'self' data: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev",
  "style-src 'self' 'unsafe-inline'",
]

export function buildContentSecurityPolicy(isHttps: boolean, localBackendUrl?: string): string {
  const directives = [...BASE_CONTENT_SECURITY_POLICY]
  if (!isHttps && localBackendUrl) {
    const backend = new URL(localBackendUrl)
    if (
      backend.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname)
    ) {
      const websocket = new URL(backend.origin)
      websocket.protocol = 'ws:'
      directives[2] += ` ${backend.origin} ${websocket.origin}`
    }
  }
  return [...directives, ...(isHttps ? ['upgrade-insecure-requests'] : [])].join('; ')
}

export function applySecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  const isHttps = new URL(request.url).protocol === 'https:'
  headers.set(
    'Content-Security-Policy',
    buildContentSecurityPolicy(
      isHttps,
      import.meta.env.DEV ? import.meta.env.VITE_CONVEX_URL : undefined
    )
  )
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  if (isHttps) headers.set('Strict-Transport-Security', 'max-age=31536000')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
