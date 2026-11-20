import { describe, expect, it } from 'vitest'
import { internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

describe('checkout recovery persistence', () => {
  it('rejects a retry that tries to bind the same session to another customer', async () => {
    const { t, userId } = await createAuthenticatedTest()
    const reservation = await t.mutation(internal.billing.reserveCheckout, {
      ownerId: userId,
      priceId: 'price_test',
      email: 'person@example.com',
      name: 'Person',
      siteUrl: 'https://app.example.com',
    })
    await t.mutation(internal.billing.recordCheckoutCustomer, {
      ownerId: userId,
      checkoutOperationId: reservation.checkoutOperationId,
      stripeCustomerId: 'cus_one',
    })
    await t.mutation(internal.billing.saveCheckout, {
      ownerId: userId,
      stripeCustomerId: 'cus_one',
      checkoutSessionId: 'cs_one',
      priceId: 'price_test',
      checkoutOperationId: reservation.checkoutOperationId,
    })
    await expect(
      t.mutation(internal.billing.saveCheckout, {
        ownerId: userId,
        stripeCustomerId: 'cus_other',
        checkoutSessionId: 'cs_one',
        priceId: 'price_test',
      })
    ).rejects.toThrow('different customer')
  })
})
