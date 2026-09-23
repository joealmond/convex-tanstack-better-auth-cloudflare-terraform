import { describe, expect, it } from 'vitest'
import type { UserIdentity } from 'convex/server'
import { api, components, internal } from './_generated/api'
import { createAuthenticatedTest, type TestBackend } from './test.utils'

async function addUser(t: TestBackend, email: string, emailVerified: boolean) {
  const now = Date.now()
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'user',
      data: { name: email, email, emailVerified, createdAt: now, updatedAt: now },
    },
  })
  const userId = user._id as string
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'session',
      data: {
        userId,
        token: `test-session-${userId}`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  })
  const asUser = t.withIdentity({
    subject: userId,
    email,
    sessionId: session._id as string,
  } as Partial<UserIdentity>)
  return { userId, asUser }
}

describe('organizations', () => {
  it('creates an owner membership and audit event', async () => {
    const owner = await createAuthenticatedTest()
    const organizationId = await owner.asUser.mutation(api.organizations.create, {
      name: 'Acme',
      slug: 'acme',
    })
    await owner.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('organizationMembers')
        .withIndex('by_organization_user', (q) =>
          q.eq('organizationId', organizationId).eq('userId', owner.userId)
        )
        .unique()
      expect(membership?.role).toBe('owner')
      expect(
        await ctx.db
          .query('organizationAuditEvents')
          .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
          .collect()
      ).toHaveLength(1)
    })
  })

  it('requires an invitation and verified email before joining', async () => {
    const owner = await createAuthenticatedTest()
    const organizationId = await owner.asUser.mutation(api.organizations.create, {
      name: 'Acme',
      slug: 'acme',
    })
    const stranger = await addUser(owner.t, 'stranger@example.com', true)
    await expect(
      stranger.asUser.mutation(api.organizations.invite, {
        organizationId,
        email: 'other@example.com',
        role: 'member',
      })
    ).rejects.toThrow()
    await owner.asUser.mutation(api.organizations.invite, {
      organizationId,
      email: 'guest@example.com',
      role: 'member',
    })
    const unverified = await addUser(owner.t, 'guest@example.com', false)
    await expect(
      unverified.asUser.mutation(api.organizations.acceptInvitation, { organizationId })
    ).rejects.toThrow()
    const verified = await addUser(owner.t, 'verified@example.com', true)
    await owner.asUser.mutation(api.organizations.invite, {
      organizationId,
      email: 'verified@example.com',
      role: 'member',
    })
    await verified.asUser.mutation(api.organizations.acceptInvitation, { organizationId })
    expect(
      await verified.asUser.query(api.organizations.hasEntitlement, {
        organizationId,
        key: 'advanced',
      })
    ).toBe(false)
    await expect(
      verified.asUser.mutation(api.organizations.setEntitlement, {
        organizationId,
        key: 'advanced',
        enabled: true,
      })
    ).rejects.toThrow()
    await owner.asUser.mutation(api.organizations.setEntitlement, {
      organizationId,
      key: 'advanced',
      enabled: true,
    })
    expect(
      await verified.asUser.query(api.organizations.hasEntitlement, {
        organizationId,
        key: 'advanced',
      })
    ).toBe(true)
    await owner.t.mutation(internal.maintenance.deleteUserDataBatch, { userId: owner.userId })
    await owner.t.run(async (ctx) => {
      const member = await ctx.db
        .query('organizationMembers')
        .withIndex('by_organization_user', (q) =>
          q.eq('organizationId', organizationId).eq('userId', verified.userId)
        )
        .unique()
      expect(member?.role).toBe('owner')
      expect((await ctx.db.get(organizationId))?.createdBy).toBe(verified.userId)
    })
  })
})
