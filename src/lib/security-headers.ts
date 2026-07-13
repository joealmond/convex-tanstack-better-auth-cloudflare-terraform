const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.sentry.io",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "object-src 'none'",
  // TanStack Start currently emits inline hydration scripts. Keep their scope
  // constrained while avoiding unsafe-eval and all third-party script origins.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
]

export function buildContentSecurityPolicy(isHttps: boolean): string {
  return [...BASE_CONTENT_SECURITY_POLICY, ...(isHttps ? ['upgrade-insecure-requests'] : [])].join(
    '; '
  )
}

export function applySecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  const isHttps = new URL(request.url).protocol === 'https:'

  headers.set('Content-Security-Policy', buildContentSecurityPolicy(isHttps))
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  if (isHttps) {
    headers.set('Strict-Transport-Security', 'max-age=31536000')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
