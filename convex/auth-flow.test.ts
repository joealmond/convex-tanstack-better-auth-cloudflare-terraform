import { afterEach, expect, it, vi } from 'vitest'
import { createTestBackend } from './test.utils'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('signs up without a session and sends verification when account email is enabled', async () => {
  vi.stubEnv('SITE_URL', 'https://app.example.com')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-32-characters')
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'resend')
  vi.stubEnv('AUTH_EMAIL_FROM', 'App <auth@example.com>')
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  const send = vi.fn().mockResolvedValue(Response.json({ id: 'email_test' }))
  vi.stubGlobal('fetch', send)
  const t = createTestBackend()
  const response = await t.fetch('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
    body: JSON.stringify({
      name: 'Person',
      email: 'person@example.com',
      password: 'long-enough-password',
    }),
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ token: null })
  expect(send).toHaveBeenCalledOnce()
  const body = JSON.parse(send.mock.calls[0]![1].body as string)
  expect(body.subject).toBe('Verify your email address')
  expect(body.to).toBe('person@example.com')
  const verificationUrl = body.text.match(/https:\/\/\S+/)?.[0]
  expect(verificationUrl).toBeTruthy()
  const verificationLink = new URL(verificationUrl!)
  const verified = await t.fetch(`${verificationLink.pathname}${verificationLink.search}`, {
    headers: { Origin: 'https://app.example.com' },
  })
  expect(verified.status).toBe(302)

  const resetRequest = await t.fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
    body: JSON.stringify({
      email: 'person@example.com',
      redirectTo: 'https://app.example.com/reset-password',
    }),
  })
  expect(resetRequest.status).toBe(200)
  expect(send).toHaveBeenCalledTimes(2)
  const resetBody = JSON.parse(send.mock.calls[1]![1].body as string)
  expect(resetBody.subject).toBe('Reset your password')
  const resetUrl = new URL(resetBody.text.match(/https:\/\/\S+/)![0])
  const resetCallback = await t.fetch(`${resetUrl.pathname}${resetUrl.search}`, {
    headers: { Origin: 'https://app.example.com' },
  })
  expect(resetCallback.status).toBe(302)
  const token = new URL(resetCallback.headers.get('location')!).searchParams.get('token')
  expect(token).toBeTruthy()
  const reset = await t.fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
    body: JSON.stringify({ token, newPassword: 'new-long-enough-password' }),
  })
  expect(reset.status).toBe(200)

  const signedIn = await t.fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
    body: JSON.stringify({ email: 'person@example.com', password: 'new-long-enough-password' }),
  })
  expect(signedIn.status).toBe(200)
  const sessionToken = ((await signedIn.json()) as { token?: string }).token
  expect(sessionToken).toBeTruthy()
  const deleteRequest = await t.fetch('/api/auth/delete-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://app.example.com',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ callbackURL: '/' }),
  })
  expect(deleteRequest.status).toBe(200)
  expect(((await deleteRequest.json()) as { message?: string }).message).toBe(
    'Verification email sent'
  )
  const deletionBody = send.mock.calls
    .map((call) => JSON.parse(call[1].body as string))
    .find((message) => message.subject === 'Confirm account deletion')
  expect(deletionBody).toBeDefined()
  const deletionUrl = new URL(deletionBody.text.match(/https:\/\/\S+/)![0])
  const deleted = await t.fetch(`${deletionUrl.pathname}${deletionUrl.search}`, {
    headers: { Origin: 'https://app.example.com', Authorization: `Bearer ${sessionToken}` },
  })
  expect(deleted.status).toBe(302)
  const afterDeletion = await t.fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
    body: JSON.stringify({ email: 'person@example.com', password: 'new-long-enough-password' }),
  })
  expect(afterDeletion.status).toBeGreaterThanOrEqual(400)
})
