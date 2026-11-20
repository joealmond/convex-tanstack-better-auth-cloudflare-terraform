import { afterEach, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

it('uses the verified account-email sender for transactional mail', async () => {
  vi.useFakeTimers()
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  vi.stubEnv('AUTH_EMAIL_FROM', 'App <auth@example.com>')
  const request = vi.fn().mockResolvedValue(Response.json({ id: 'email_test' }))
  vi.stubGlobal('fetch', request)
  const { t, asUser } = await createAuthenticatedTest()

  await asUser.mutation(api.emails.requestTest)
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  expect(JSON.parse(request.mock.calls[0]![1].body as string).from).toBe('App <auth@example.com>')
  expect(await asUser.query(api.emails.listMine)).toMatchObject([{ status: 'sent' }])
})

it('records a sender configuration error without contacting Resend', async () => {
  vi.useFakeTimers()
  vi.stubEnv('RESEND_API_KEY', 're_test_only')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  const { t, asUser } = await createAuthenticatedTest()

  await asUser.mutation(api.emails.requestTest)
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  expect(request).not.toHaveBeenCalled()
  expect(await asUser.query(api.emails.listMine)).toMatchObject([
    { status: 'error', error: expect.stringContaining('AUTH_EMAIL_FROM') },
  ])
})
