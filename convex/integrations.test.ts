import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

afterEach(() => {
  vi.useRealTimers()
  delete process.env.OPENAI_API_KEY
  delete process.env.RESEND_API_KEY
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_PRICE_ID
  delete process.env.STRIPE_WEBHOOK_SECRET
})

describe('optional integrations', () => {
  it('records a clear AI configuration error from the scheduled action', async () => {
    vi.useFakeTimers()
    const { t, asUser } = await createAuthenticatedTest()
    const runId = await asUser.mutation(api.ai.start, { prompt: 'Say hello' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([
      { _id: runId, status: 'error', error: expect.stringContaining('OPENAI_API_KEY') },
    ])
  })

  it('queues email and records missing Resend configuration', async () => {
    vi.useFakeTimers()
    const { t, asUser } = await createAuthenticatedTest()
    const deliveryId = await asUser.mutation(api.emails.requestTest)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.emails.listMine)).toMatchObject([
      { _id: deliveryId, status: 'error', error: expect.stringContaining('RESEND_API_KEY') },
    ])
  })

  it('applies Stripe events idempotently and exposes subscription state', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    const event = {
      eventId: 'evt_test',
      eventType: 'customer.subscription.updated',
      ownerId: userId,
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      priceId: 'price_test',
      status: 'active',
      currentPeriodEnd: Date.now() + 1_000,
    }
    await t.mutation(internal.billing.applyStripeEvent, event)
    await t.mutation(internal.billing.applyStripeEvent, { ...event, status: 'cancelled' })
    expect(await asUser.query(api.billing.current)).toMatchObject({
      stripeSubscriptionId: 'sub_test',
      status: 'active',
    })
    expect(await t.run((ctx) => ctx.db.query('stripeEvents').collect())).toHaveLength(1)
  })

  it('rejects checkout and webhook calls without server secrets', async () => {
    const { t, asUser } = await createAuthenticatedTest()
    await expect(asUser.action(api.stripe.createCheckout)).rejects.toThrow('STRIPE_PRICE_ID')
    const response = await t.fetch('/api/stripe/webhook', { method: 'POST', body: '{}' })
    expect(response.status).toBe(400)
  })
})
