import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete process.env.OPENAI_API_KEY
  delete process.env.RESEND_API_KEY
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_PRICE_ID
  delete process.env.STRIPE_WEBHOOK_SECRET
})

describe('optional integrations', () => {
  it('persists streamed AI output across partial events and marks completion', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel'
          )
        )
        controller.enqueue(
          encoder.encode('lo"}\n\ndata: {"type":"response.created"}\n\ndata: [DONE]\n\n')
        )
        controller.close()
      },
    })
    const request = vi.fn().mockResolvedValue(new Response(stream))
    vi.stubGlobal('fetch', request)
    const { t, asUser, userId } = await createAuthenticatedTest()
    const runId = await asUser.mutation(api.ai.start, { prompt: ' Say hello ' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([
      { output: 'Hello', status: 'completed', prompt: 'Say hello' },
    ])
    await t.mutation(internal.ai.appendOutput, {
      runId,
      ownerId: userId,
      chunk: 'late',
      model: 'test',
    })
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([{ output: 'Hello' }])
    expect(request).toHaveBeenCalledOnce()
  })

  it('validates AI prompts and records provider failures', async () => {
    vi.useFakeTimers()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))
    const { t, asUser } = await createAuthenticatedTest()
    await expect(asUser.mutation(api.ai.start, { prompt: ' ' })).rejects.toThrow(
      'Prompt is required'
    )
    await expect(asUser.mutation(api.ai.start, { prompt: 'x'.repeat(1001) })).rejects.toThrow(
      '1000 characters'
    )
    await asUser.mutation(api.ai.start, { prompt: 'test' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.ai.listRecent)).toMatchObject([
      { status: 'error', error: expect.stringContaining('503') },
    ])
  })

  it('deduplicates welcome mail, escapes HTML, and records delivery ownership', async () => {
    vi.useFakeTimers()
    vi.stubEnv('RESEND_API_KEY', 're_test_only')
    const request = vi.fn().mockResolvedValue(Response.json({ id: 'email_test' }))
    vi.stubGlobal('fetch', request)
    const { t, asUser, userId } = await createAuthenticatedTest()
    const args = { ownerId: userId, to: 'test@example.com', name: '<Ada & "friends">' }
    const deliveryId = await t.mutation(internal.emails.enqueueWelcome, args)
    expect(await t.mutation(internal.emails.enqueueWelcome, args)).toBe(deliveryId)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.emails.listMine)).toMatchObject([
      { status: 'sent', providerId: 'email_test' },
    ])
    const body = JSON.parse(request.mock.calls[0]![1].body as string)
    expect(body.html).toContain('&lt;Ada &amp; &quot;friends&quot;&gt;')
    await t.mutation(internal.emails.markFailed, {
      deliveryId,
      ownerId: 'another-user',
      error: 'wrong owner',
    })
    await t.mutation(internal.emails.markSent, {
      deliveryId,
      ownerId: 'another-user',
      providerId: 'wrong owner',
    })
    expect(await asUser.query(api.emails.listMine)).toMatchObject([
      { status: 'sent', providerId: 'email_test' },
    ])
  })

  it('records a failed email provider response', async () => {
    vi.useFakeTimers()
    vi.stubEnv('RESEND_API_KEY', 're_test_only')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { name: 'validation_error', message: 'Invalid sender', statusCode: 422 },
            { status: 422 }
          )
        )
    )
    const { t, asUser } = await createAuthenticatedTest()
    await asUser.mutation(api.emails.requestTest)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await asUser.query(api.emails.listMine)).toMatchObject([
      { status: 'error', error: 'Invalid sender' },
    ])
  })

  it('updates checkout records and resolves webhook owners by customer ID', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    const checkout = {
      ownerId: userId,
      stripeCustomerId: 'cus_test',
      checkoutSessionId: 'cs_first',
      priceId: 'price_test',
    }
    const id = await t.mutation(internal.billing.saveCheckout, checkout)
    expect(
      await t.mutation(internal.billing.saveCheckout, {
        ...checkout,
        checkoutSessionId: 'cs_second',
      })
    ).toBe(id)
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      checkoutSessionId: 'cs_second',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_customer',
      eventType: 'customer.subscription.updated',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      status: 'active',
    })
    expect(await asUser.query(api.billing.current)).toMatchObject({
      checkoutSessionId: 'cs_second',
      priceId: 'price_test',
      status: 'active',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_unknown',
      eventType: 'customer.subscription.updated',
      stripeCustomerId: 'cus_unknown',
      status: 'active',
    })
    expect(await t.run((ctx) => ctx.db.query('billingSubscriptions').collect())).toHaveLength(1)
  })
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

  it.each(['active', 'trialing', 'past_due'])(
    'blocks deletion while a subscription is %s',
    async (status) => {
      const { t, userId } = await createAuthenticatedTest()
      await t.mutation(internal.billing.saveCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_delete_blocked',
        checkoutSessionId: 'cs_delete_blocked',
        priceId: 'price_test',
      })
      await t.mutation(internal.billing.applyStripeEvent, {
        eventId: `evt_delete_${status}`,
        eventType: 'customer.subscription.updated',
        ownerId: userId,
        stripeCustomerId: 'cus_delete_blocked',
        stripeSubscriptionId: 'sub_delete_blocked',
        status,
      })

      await expect(
        t.query(internal.billing.assertAccountDeletionAllowed, { ownerId: userId })
      ).rejects.toThrow('Cancel your Stripe subscription')
      await expect(
        t.mutation(internal.billing.prepareAccountDeletion, { ownerId: userId })
      ).rejects.toThrow('Cancel your Stripe subscription')
    }
  )

  it('allows a cancelled subscription, keeps a tombstone, and ignores a delayed webhook', async () => {
    const { t, userId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId: userId,
      stripeCustomerId: 'cus_deleted',
      checkoutSessionId: 'cs_deleted',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_cancelled_before_delete',
      eventType: 'customer.subscription.deleted',
      ownerId: userId,
      stripeCustomerId: 'cus_deleted',
      stripeSubscriptionId: 'sub_deleted',
      status: 'canceled',
    })

    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId: userId })
    ).resolves.toBeNull()
    await t.mutation(internal.billing.prepareAccountDeletion, { ownerId: userId })
    await t.mutation(internal.maintenance.deleteUserDataBatch, { userId })
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toBeNull()
    expect(await t.query(internal.billing.getDeletionTombstone, { ownerId: userId })).toMatchObject(
      {
        stripeCustomerId: 'cus_deleted',
        stripeSubscriptionId: 'sub_deleted',
      }
    )

    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_delayed_after_delete',
      eventType: 'customer.subscription.updated',
      ownerId: userId,
      stripeCustomerId: 'cus_deleted',
      stripeSubscriptionId: 'sub_deleted',
      status: 'active',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('stripeEvents').collect())).toHaveLength(2)
  })

  it('rejects checkout and webhook calls without server secrets', async () => {
    const { t, asUser } = await createAuthenticatedTest()
    await expect(asUser.action(api.stripe.createCheckout)).rejects.toThrow('STRIPE_PRICE_ID')
    const response = await t.fetch('/api/stripe/webhook', { method: 'POST', body: '{}' })
    expect(response.status).toBe(400)
  })
})
