import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

describe('organizations', () => {
  it('creates an owner membership and audit event', async () => {
    const owner = await createAuthenticatedTest()
    const organizationId = await owner.asUser.mutation(api.organizations.create, { name: 'Acme', slug: 'acme' })
    await owner.t.run(async (ctx) => {
      const membership = await ctx.db.query('organizationMembers').withIndex('by_organization_user', (q) => q.eq('organizationId', organizationId).eq('userId', owner.userId)).unique()
      expect(membership?.role).toBe('owner')
      expect(await ctx.db.query('organizationAuditEvents').withIndex('by_organization', (q) => q.eq('organizationId', organizationId)).collect()).toHaveLength(1)
    })
  })
})
