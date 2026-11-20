import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

const origin = 'https://app.example.com'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function setup() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
  vi.stubEnv('STRIPE_PRICE_ID', 'price_changed')
  vi.stubEnv('SITE_URL', 'https://changed.example.com')
  const fixture = await createAuthenticatedTest()
  const reservation = await fixture.t.mutation(internal.billing.reserveCheckout, {
    ownerId: fixture.userId,
    priceId: 'price_original',
    email: 'original@example.com',
    name: 'Original',
    siteUrl: origin,
  })
  return { ...fixture, reservation }
}

function provider(userId: string, operation: string, status = 'expired') {
  const calls: Array<{ url: URL; options: RequestInit }> = []
  const customer = {
    id: 'cus_recovery',
    object: 'customer',
    created: Math.floor(Date.now() / 1000),
    metadata: { userId },
  }
  const session = {
    id: 'cs_recovery',
    object: 'checkout.session',
    customer: customer.id,
    status,
    url: `${origin}/checkout`,
    subscription: status === 'complete' ? 'sub_recovery' : null,
    metadata: { userId, checkoutOperationId: operation },
  }
  const fetch = vi.fn(async (url: string, options: RequestInit = {}) => {
    const parsed = new URL(url)
    calls.push({ url: parsed, options })
    if (parsed.pathname.startsWith('/v1/customers')) return Response.json(customer)
    if (parsed.pathname === '/v1/subscriptions/sub_recovery')
      return Response.json({
        id: 'sub_recovery',
        object: 'subscription',
        customer: customer.id,
        status: 'active',
        items: { data: [{ current_period_end: 100 }] },
      })
    if (parsed.pathname === '/v1/subscriptions')
      return Response.json({ object: 'list', data: [], has_more: false })
    if (parsed.pathname === '/v1/checkout/sessions' && options.method === 'POST')
      return Response.json(session)
    if (parsed.pathname === '/v1/checkout/sessions')
      return Response.json({ object: 'list', data: [session], has_more: false })
    throw new Error(`Unexpected provider request ${parsed.pathname}`)
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, calls, customer, session }
}

describe('Checkout recovery actions', () => {
  it('uses immutable request data and one idempotency operation for concurrent actions', async () => {
    const { asUser, t, userId, reservation } = await setup()
    const { calls } = provider(userId, reservation.checkoutOperationId, 'open')
    const results = await Promise.all([
      asUser.action(api.stripe.createCheckout),
      asUser.action(api.stripe.createCheckout),
    ])
    expect(results).toEqual([{ url: `${origin}/checkout` }, { url: `${origin}/checkout` }])
    const requests = calls.filter((call) => call.options.method === 'POST')
    const keys = requests.map((call) => new Headers(call.options.headers).get('idempotency-key'))
    expect(new Set(keys.filter((key) => key?.startsWith('convexkit-customer-'))).size).toBe(1)
    expect(new Set(keys.filter((key) => key?.startsWith('convexkit-checkout-'))).size).toBe(1)
    for (const request of requests) {
      const body = new URLSearchParams(String(request.options.body))
      if (request.url.pathname.includes('customers')) {
        expect(body.get('email')).toBe('original@example.com')
        expect(body.get('name')).toBe('Original')
      } else {
        expect(body.get('line_items[0][price]')).toBe('price_original')
        expect(body.get('success_url')).toContain(origin)
      }
    }
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      status: 'checkout_pending',
      stripeCustomerId: 'cus_recovery',
    })
  })

  it('reconciles an expired session beyond the first 100 results without creating provider objects', async () => {
    const { t, userId, reservation } = await setup()
    const { fetch, session, customer, calls } = provider(userId, reservation.checkoutOperationId)
    await t.mutation(internal.billing.recordCheckoutCustomer, {
      ownerId: userId,
      checkoutOperationId: reservation.checkoutOperationId,
      stripeCustomerId: customer.id,
    })
    const original = fetch.getMockImplementation()!
    fetch.mockImplementation(async (url, options) => {
      const parsed = new URL(url)
      if (parsed.pathname === '/v1/checkout/sessions') {
        calls.push({ url: parsed, options: options ?? {} })
        return Response.json({
          object: 'list',
          data: parsed.searchParams.has('starting_after')
            ? [session]
            : Array.from({ length: 100 }, (_, index) => ({
                id: `cs_old_${index}`,
                status: 'expired',
                metadata: {},
              })),
          has_more: !parsed.searchParams.has('starting_after'),
        })
      }
      return original(url, options)
    })
    expect(await t.action(internal.stripe.reconcileCheckout, { ownerId: userId })).toMatchObject({
      status: 'checkout_expired',
    })
    expect(calls.filter((call) => call.url.pathname === '/v1/checkout/sessions')).toHaveLength(2)
    expect(calls.every((call) => call.options.method !== 'POST')).toBe(true)
    await expect(
      t.mutation(internal.billing.reserveCheckout, {
        ownerId: userId,
        priceId: 'price_new',
        email: 'original@example.com',
        name: 'Original',
        siteUrl: origin,
      })
    ).resolves.toMatchObject({ checkoutOperationId: expect.any(String) })
  })

  it('recovers an unrecorded customer through a verified operator ID and preserves a completed subscription', async () => {
    const { t, userId, reservation } = await setup()
    provider(userId, reservation.checkoutOperationId, 'complete')
    expect(
      await t.action(internal.stripe.reconcileCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_recovery',
      })
    ).toMatchObject({ status: 'active' })
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      stripeSubscriptionId: 'sub_recovery',
      status: 'active',
      currentPeriodEnd: 100_000,
    })
  })

  it('rejects operator IDs belonging to another account', async () => {
    const { t, userId, reservation } = await setup()
    provider('other_owner', reservation.checkoutOperationId)
    await expect(
      t.action(internal.stripe.reconcileCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_recovery',
      })
    ).rejects.toThrow('ownership')
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toMatchObject({
      status: 'checkout_creating',
    })
  })

  it('requires exact operator confirmation before releasing a verified absent session', async () => {
    const { t, userId, reservation } = await setup()
    const { fetch } = provider(userId, reservation.checkoutOperationId)
    const original = fetch.getMockImplementation()!
    fetch.mockImplementation(async (url, options) =>
      new URL(url).pathname === '/v1/checkout/sessions'
        ? Response.json({ object: 'list', data: [], has_more: false })
        : original(url, options)
    )
    await expect(
      t.action(internal.stripe.reconcileCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_recovery',
      })
    ).rejects.toThrow('operator confirmation')
    await expect(
      t.action(internal.stripe.reconcileCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_recovery',
        confirmNoCheckout: true,
        expectedOperationId: reservation.checkoutOperationId,
      })
    ).resolves.toMatchObject({ status: 'provider_clear' })
  })

  it('does not reserve billing when provider configuration is missing', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    vi.stubEnv('SITE_URL', origin)
    vi.stubEnv('STRIPE_PRICE_ID', 'price_test')
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    await expect(asUser.action(api.stripe.createCheckout)).rejects.toThrow('STRIPE_SECRET_KEY')
    expect(await t.query(internal.billing.getByOwner, { ownerId: userId })).toBeNull()
  })
})
