import { afterEach, expect, it, vi } from 'vitest'
import { internal } from './_generated/api'
import { createTestBackend } from './test.utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('sends account links only with an opted-in provider and the configured origin', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'resend')
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  vi.stubEnv('AUTH_EMAIL_FROM', 'App <auth@example.com>')
  vi.stubEnv('SITE_URL', 'https://app.example.com')
  const request = vi.fn().mockResolvedValue(Response.json({ id: 'email_test' }))
  vi.stubGlobal('fetch', request)
  const t = createTestBackend()
  const url = 'https://app.example.com/api/auth/verify-email?token=abc&callbackURL=%2F'
  await t.action(internal.authEmails.send, { to: 'user@example.com', url, kind: 'verify' })
  const body = JSON.parse(request.mock.calls[0]![1].body as string)
  expect(body.to).toBe('user@example.com')
  expect(body.subject).toBe('Verify your email address')
  expect(body.text).toContain(url)
  expect(body.html).toContain('&amp;callbackURL=')
  await expect(
    t.action(internal.authEmails.send, {
      to: 'user@example.com',
      url: 'https://attacker.example/api/auth/verify-email?token=abc',
      kind: 'verify',
    })
  ).rejects.toThrow('wrong origin')
  expect(request).toHaveBeenCalledOnce()
})

it('does not contact a provider when account email is disabled', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'disabled')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  await expect(
    createTestBackend().action(internal.authEmails.send, {
      to: 'user@example.com',
      url: 'https://app.example.com/api/auth/verify-email?token=abc',
      kind: 'verify',
    })
  ).rejects.toThrow('not configured')
  expect(request).not.toHaveBeenCalled()
})

it('hides provider errors and signed links when delivery fails', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'resend')
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  vi.stubEnv('AUTH_EMAIL_FROM', 'App <auth@example.com>')
  vi.stubEnv('SITE_URL', 'https://app.example.com')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ message: 'provider detail' }, { status: 422 }))
  )
  const url = 'https://app.example.com/api/auth/reset-password/secret-token'
  await expect(
    createTestBackend().action(internal.authEmails.send, {
      to: 'user@example.com',
      url,
      kind: 'reset',
    })
  ).rejects.toThrow('Account email delivery failed')
})
