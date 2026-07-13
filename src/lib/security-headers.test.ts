import { describe, expect, it } from 'vitest'
import { applySecurityHeaders, buildContentSecurityPolicy } from './security-headers'

describe('security headers', () => {
  it('adds a restrictive policy and HSTS to HTTPS responses', async () => {
    const response = applySecurityHeaders(
      new Response('ok', { headers: { 'content-type': 'text/plain' } }),
      new Request('https://app.example.com/')
    )

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(response.headers.get('content-security-policy')).toContain("object-src 'none'")
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toBe('ok')
  })

  it('does not force HSTS or HTTPS upgrades during local HTTP development', () => {
    const response = applySecurityHeaders(new Response(null), new Request('http://localhost:3000/'))

    expect(response.headers.has('strict-transport-security')).toBe(false)
    expect(buildContentSecurityPolicy(false)).not.toContain('upgrade-insecure-requests')
  })
})
