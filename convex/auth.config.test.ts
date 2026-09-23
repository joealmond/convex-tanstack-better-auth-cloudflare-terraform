import { afterEach, expect, it, vi } from 'vitest'
// <convexkit:billing>
import { internal } from './_generated/api'
// </convexkit:billing>

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

it('passes an email to account cleanup only after mailbox verification', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'disabled')
  const { createAuth } = await import('./auth')
  const runAfter = vi.fn()
  const auth = createAuth({ scheduler: { runAfter } } as never)
  const afterDelete = auth.options.user?.deleteUser?.afterDelete
  await afterDelete?.({ id: 'user-1', email: 'person@example.com', emailVerified: false } as never)
  await afterDelete?.({ id: 'user-2', email: 'person@example.com', emailVerified: true } as never)
  expect(runAfter.mock.calls.map((call) => call[2])).toEqual([
    { userId: 'user-1', email: undefined },
    { userId: 'user-2', email: 'person@example.com' },
  ])
})

// <convexkit:billing>
it('guards billable account deletion before creating a webhook tombstone', async () => {
  vi.stubEnv('AUTH_EMAIL_PROVIDER', 'disabled')
  const { createAuth } = await import('./auth')
  const runQuery = vi.fn().mockResolvedValue(undefined)
  const runAction = vi.fn().mockResolvedValue(undefined)
  const runMutation = vi.fn().mockResolvedValue(undefined)
  const auth = createAuth({ runQuery, runAction, runMutation } as never)
  await auth.options.user?.deleteUser?.beforeDelete?.({ id: 'user-1' } as never)
  expect(runQuery).toHaveBeenCalledWith(internal.billing.assertAccountDeletionAllowed, {
    ownerId: 'user-1',
  })
  expect(runAction).toHaveBeenCalledWith(internal.stripe.assertNoProviderObligations, {
    ownerId: 'user-1',
  })
  expect(runMutation).toHaveBeenCalledWith(internal.billing.prepareAccountDeletion, {
    ownerId: 'user-1',
  })
  runQuery.mockRejectedValueOnce(new Error('active subscription'))
  await expect(
    auth.options.user?.deleteUser?.beforeDelete?.({ id: 'user-2' } as never)
  ).rejects.toThrow('active subscription')
  expect(runMutation).toHaveBeenCalledTimes(1)
})
// </convexkit:billing>
