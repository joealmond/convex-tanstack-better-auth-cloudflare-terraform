import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.restoreAllMocks()
})

it('accepts the empty optional values emitted by the setup wizard', async () => {
  vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
  vi.stubEnv('VITE_CONVEX_SITE_URL', 'https://example.convex.site')
  vi.stubEnv('VITE_SENTRY_DSN', '')
  const { env } = await import('./env')
  expect(env.VITE_SENTRY_DSN).toBeUndefined()
})

it('still rejects a nonempty invalid Sentry URL', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
  vi.stubEnv('VITE_SENTRY_DSN', 'invalid')
  await expect(import('./env')).rejects.toThrow('Invalid environment configuration')
})
