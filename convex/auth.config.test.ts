import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('keeps credential-free local auth usable', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'disabled')
  const { createAuth } = await import('./auth')
  const auth = createAuth({} as never)
  expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(false)
  expect(auth.options.emailAndPassword?.sendResetPassword).toBeUndefined()
  expect(auth.options.user?.deleteUser?.sendDeleteAccountVerification).toBeUndefined()
})

it('enables verification, reset, and deletion mail with complete server configuration', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'resend')
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  vi.stubEnv('AUTH_EMAIL_FROM', 'App <auth@example.com>')
  const { createAuth } = await import('./auth')
  const runAction = vi.fn()
  const auth = createAuth({ runAction } as never)
  expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true)
  expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true)
  expect(auth.options.emailAndPassword?.sendResetPassword).toBeTypeOf('function')
  expect(auth.options.emailVerification?.sendVerificationEmail).toBeTypeOf('function')
  expect(auth.options.user?.deleteUser?.sendDeleteAccountVerification).toBeTypeOf('function')
  const user = { email: 'person@example.com' }
  const url = 'https://app.example.com/api/auth/verify-email?token=fixture'
  await auth.options.emailVerification?.sendVerificationEmail?.({
    user,
    url,
    token: 'fixture',
  } as never)
  await auth.options.emailAndPassword?.sendResetPassword?.({ user, url, token: 'fixture' } as never)
  await auth.options.user?.deleteUser?.sendDeleteAccountVerification?.({
    user,
    url,
    token: 'fixture',
  } as never)
  expect(runAction.mock.calls.map((call) => call[1])).toEqual([
    { kind: 'verify', to: user.email, url },
    { kind: 'reset', to: user.email, url },
    { kind: 'delete', to: user.email, url },
  ])
})
