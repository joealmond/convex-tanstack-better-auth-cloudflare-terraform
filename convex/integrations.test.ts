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

  it('keeps pending checkout records and resolves webhook owners by customer ID', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    const checkout = {
      ownerId: userId,
      stripeCustomerId: 'cus_test',
      checkoutSessionId: 'cs_first',
      priceId: 'price_test',
    }
    await t.mutation(internal.billing.saveCheckout, checkout)
    await expect(
      t.mutation(internal.billing.saveCheckout, {
        ...checkout,
        checkoutSessionId: 'cs_second',
      })
    ).rejects.toThrow('already exists')
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      checkoutSessionId: 'cs_first',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_customer',
      eventType: 'customer.subscription.updated',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      status: 'active',
    })
    expect(await asUser.query(api.billing.current)).toMatchObject({ status: 'checkout_pending' })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_checkout_completed',
      eventType: 'checkout.session.completed',
      ownerId: userId,
      stripeCustomerId: 'cus_test',
      checkoutSessionId: 'cs_first',
      stripeSubscriptionId: 'sub_test',
      status: 'checkout_completed',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_customer_after_binding',
      eventType: 'customer.subscription.updated',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      status: 'active',
    })
    expect(await asUser.query(api.billing.current)).toMatchObject({
      checkoutSessionId: 'cs_first',
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
      ).rejects.toThrow('billing portal')
      await expect(
        t.mutation(internal.billing.prepareAccountDeletion, { ownerId: userId })
      ).rejects.toThrow('billing portal')
    }
  )

  it('blocks deletion until a pending Checkout session expires', async () => {
    const { t, userId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId: userId,
      stripeCustomerId: 'cus_checkout_pending',
      checkoutSessionId: 'cs_checkout_pending',
      priceId: 'price_test',
    })

    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId: userId })
    ).rejects.toThrow('billing portal')

    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_checkout_expired',
      eventType: 'checkout.session.expired',
      ownerId: userId,
      stripeCustomerId: 'cus_checkout_pending',
      checkoutSessionId: 'cs_checkout_pending',
      status: 'checkout_expired',
    })

    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId: userId })
    ).resolves.toBeNull()
  })

  it('clears an old subscription before a new Checkout and accepts its expiration', async () => {
    const { t, userId } = await createAuthenticatedTest()
    const ownerId = userId
    const stripeCustomerId = 'cus_recheckout'
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_completed',
      eventType: 'checkout.session.completed',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      stripeSubscriptionId: 'sub_old',
      status: 'checkout_completed',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_canceled',
      eventType: 'customer.subscription.deleted',
      ownerId,
      stripeCustomerId,
      stripeSubscriptionId: 'sub_old',
      status: 'canceled',
    })
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_new',
      priceId: 'price_test',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      status: 'checkout_pending',
      checkoutSessionId: 'cs_new',
    })
    expect((await t.query(internal.billing.getByOwner, { ownerId }))?.stripeSubscriptionId).toBe(
      undefined
    )
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_delayed',
      eventType: 'customer.subscription.updated',
      ownerId,
      stripeCustomerId,
      stripeSubscriptionId: 'sub_old',
      status: 'active',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      status: 'checkout_pending',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_new_expired',
      eventType: 'checkout.session.expired',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_new',
      status: 'checkout_expired',
    })
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId })
    ).resolves.toBeNull()
  })

  it('ignores expiration of an older Checkout after a replacement starts', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    const stripeCustomerId = 'cus_sequential_checkout'
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_expired',
      eventType: 'checkout.session.expired',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      status: 'checkout_expired',
    })
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_new',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_expired_late',
      eventType: 'checkout.session.expired',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      status: 'checkout_expired',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      checkoutSessionId: 'cs_new',
      status: 'checkout_pending',
    })
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId })
    ).rejects.toThrow('billing portal')
  })

  it('ignores an old subscription event after a replacement subscription is bound', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    const stripeCustomerId = 'cus_replace'
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_first_complete',
      eventType: 'checkout.session.completed',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_old',
      stripeSubscriptionId: 'sub_old',
      status: 'checkout_completed',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_first_cancel',
      eventType: 'customer.subscription.deleted',
      ownerId,
      stripeCustomerId,
      stripeSubscriptionId: 'sub_old',
      status: 'canceled',
    })
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_new',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_second_complete',
      eventType: 'checkout.session.completed',
      ownerId,
      stripeCustomerId,
      checkoutSessionId: 'cs_new',
      stripeSubscriptionId: 'sub_new',
      status: 'checkout_completed',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_old_late_cancel',
      eventType: 'customer.subscription.deleted',
      ownerId,
      stripeCustomerId,
      stripeSubscriptionId: 'sub_old',
      status: 'canceled',
    })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      stripeSubscriptionId: 'sub_new',
      status: 'checkout_completed',
    })
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId })
    ).rejects.toThrow('billing portal')
  })

  it('blocks deletion when Stripe still has a subscription or an open Checkout', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId: 'cus_provider_check',
      checkoutSessionId: 'cs_provider_check',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_provider_checkout_expired',
      eventType: 'checkout.session.expired',
      ownerId,
      stripeCustomerId: 'cus_provider_check',
      checkoutSessionId: 'cs_provider_check',
      status: 'checkout_expired',
    })
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
    const fetch = vi.fn().mockResolvedValueOnce(
      Response.json({
        object: 'list',
        data: [{ id: 'sub_unseen', status: 'active' }],
        has_more: false,
      })
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    ).rejects.toThrow('Cancel all Stripe subscriptions')

    fetch
      .mockResolvedValueOnce(Response.json({ object: 'list', data: [], has_more: false }))
      .mockResolvedValueOnce(
        Response.json({ object: 'list', data: [{ id: 'cs_open' }], has_more: false })
      )
    await expect(
      t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    ).rejects.toThrow('open Stripe Checkout')

    fetch
      .mockResolvedValueOnce(Response.json({ object: 'list', data: [], has_more: false }))
      .mockResolvedValueOnce(Response.json({ object: 'list', data: [], has_more: false }))
    await t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    await t.mutation(internal.billing.prepareAccountDeletion, { ownerId })
    await t.mutation(internal.maintenance.deleteUserDataBatch, { userId: ownerId })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toBeNull()
    expect(await t.query(internal.billing.getDeletionTombstone, { ownerId })).toMatchObject({
      stripeCustomerId: 'cus_provider_check',
    })
    fetch.mockResolvedValueOnce(
      Response.json({
        object: 'list',
        data: [{ id: 'sub_late', status: 'active' }],
        has_more: false,
      })
    )
    await expect(
      t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    ).rejects.toThrow('Cancel all Stripe subscriptions')
  })

  it('reconciles a missed terminal webhook against Stripe before deletion', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId: 'cus_missed_terminal',
      checkoutSessionId: 'cs_missed_terminal',
      priceId: 'price_test',
    })
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: string) =>
          Promise.resolve(
            Response.json(
              String(input).includes('/checkout/sessions/cs_missed_terminal')
                ? { id: 'cs_missed_terminal', status: 'expired' }
                : { object: 'list', data: [], has_more: false }
            )
          )
        )
    )
    await t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      status: 'provider_clear',
    })
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId })
    ).resolves.toBeNull()
    await t.mutation(internal.billing.prepareAccountDeletion, { ownerId })
    await t.mutation(internal.maintenance.deleteUserDataBatch, { userId: ownerId })
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toBeNull()
  })

  it('blocks deletion when Checkout completes between Stripe list calls', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId: 'cus_checkout_race',
      checkoutSessionId: 'cs_checkout_race',
      priceId: 'price_test',
    })
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
    const fetch = vi.fn().mockImplementation((input: string) => {
      const url = String(input)
      if (url.includes('/checkout/sessions/cs_checkout_race'))
        return Promise.resolve(
          Response.json({
            id: 'cs_checkout_race',
            status: 'complete',
            subscription: 'sub_checkout_race',
          })
        )
      if (url.includes('/subscriptions/sub_checkout_race'))
        return Promise.resolve(Response.json({ id: 'sub_checkout_race', status: 'active' }))
      return Promise.resolve(Response.json({ object: 'list', data: [], has_more: false }))
    })
    vi.stubGlobal('fetch', fetch)
    await expect(
      t.action(internal.stripe.assertNoProviderObligations, { ownerId })
    ).rejects.toThrow('Cancel all Stripe subscriptions')
    expect(await t.query(internal.billing.getByOwner, { ownerId })).toMatchObject({
      status: 'checkout_pending',
    })
  })

  it('accepts the current terminal subscription state when Checkout completion arrives late', async () => {
    const { t, userId: ownerId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId,
      stripeCustomerId: 'cus_late_completion',
      checkoutSessionId: 'cs_late_completion',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_canceled_before_completion',
      eventType: 'customer.subscription.deleted',
      ownerId,
      stripeCustomerId: 'cus_late_completion',
      stripeSubscriptionId: 'sub_late_completion',
      status: 'canceled',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_late_completion',
      eventType: 'checkout.session.completed',
      ownerId,
      stripeCustomerId: 'cus_late_completion',
      checkoutSessionId: 'cs_late_completion',
      stripeSubscriptionId: 'sub_late_completion',
      status: 'canceled',
    })
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId })
    ).resolves.toBeNull()
  })

  it('keeps subscription state when a Checkout event arrives late and blocks duplicate Checkout', async () => {
    vi.stubEnv('SITE_URL', 'https://app.example.com')
    vi.stubEnv('STRIPE_PRICE_ID', 'price_test')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { t, asUser, userId } = await createAuthenticatedTest()
    const checkout = {
      ownerId: userId,
      stripeCustomerId: 'cus_out_of_order',
      checkoutSessionId: 'cs_first',
      priceId: 'price_test',
    }
    await t.mutation(internal.billing.saveCheckout, checkout)
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_checkout_bound',
      eventType: 'checkout.session.completed',
      ownerId: userId,
      stripeCustomerId: 'cus_out_of_order',
      checkoutSessionId: 'cs_first',
      stripeSubscriptionId: 'sub_active',
      status: 'checkout_completed',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_subscription_active',
      eventType: 'customer.subscription.updated',
      ownerId: userId,
      stripeCustomerId: 'cus_out_of_order',
      stripeSubscriptionId: 'sub_active',
      status: 'active',
    })

    await expect(
      t.mutation(internal.billing.saveCheckout, {
        ...checkout,
        checkoutSessionId: 'cs_second',
      })
    ).rejects.toThrow('already exists')
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_checkout_expired_late',
      eventType: 'checkout.session.expired',
      ownerId: userId,
      stripeCustomerId: 'cus_out_of_order',
      checkoutSessionId: 'cs_second',
      status: 'checkout_expired',
    })

    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      stripeSubscriptionId: 'sub_active',
      status: 'active',
      checkoutSessionId: 'cs_first',
    })
    await expect(asUser.action(api.stripe.createCheckout)).rejects.toThrow(
      'existing Stripe subscription'
    )
    expect(fetch).not.toHaveBeenCalled()
    await expect(
      t.query(internal.billing.assertAccountDeletionAllowed, { ownerId: userId })
    ).rejects.toThrow('billing portal')
  })

  it('allows a cancelled subscription, keeps a tombstone, and ignores a delayed webhook', async () => {
    const { t, userId } = await createAuthenticatedTest()
    await t.mutation(internal.billing.saveCheckout, {
      ownerId: userId,
      stripeCustomerId: 'cus_deleted',
      checkoutSessionId: 'cs_deleted',
      priceId: 'price_test',
    })
    await t.mutation(internal.billing.applyStripeEvent, {
      eventId: 'evt_checkout_before_delete',
      eventType: 'checkout.session.completed',
      ownerId: userId,
      stripeCustomerId: 'cus_deleted',
      checkoutSessionId: 'cs_deleted',
      stripeSubscriptionId: 'sub_deleted',
      status: 'checkout_completed',
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
    await expect(
      t.mutation(internal.billing.saveCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_deleted',
        checkoutSessionId: 'cs_new_after_delete',
        priceId: 'price_test',
      })
    ).rejects.toThrow('being deleted')
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
    expect(await t.run((ctx) => ctx.db.query('stripeEvents').collect())).toHaveLength(3)
  })

  it('rejects checkout and webhook calls without server secrets', async () => {
    const { t, asUser } = await createAuthenticatedTest()
    await expect(asUser.action(api.stripe.createCheckout)).rejects.toThrow('STRIPE_PRICE_ID')
    const response = await t.fetch('/api/stripe/webhook', { method: 'POST', body: '{}' })
    expect(response.status).toBe(400)
  })
})
