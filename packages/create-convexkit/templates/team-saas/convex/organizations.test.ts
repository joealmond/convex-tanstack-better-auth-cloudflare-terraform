import { describe, expect, it, vi } from 'vitest'
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
      (await verified.asUser.query(api.userExport.page, { kind: 'organizationMembers' })).page
    ).toHaveLength(1)
    expect(
      (await unverified.asUser.query(api.userExport.page, { kind: 'organizationInvitations' })).page
    ).toEqual([])
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

  it('deletes a large sole-owner organization in bounded batches', async () => {
    vi.useFakeTimers()
    try {
      const owner = await createAuthenticatedTest()
      const organizationId = await owner.asUser.mutation(api.organizations.create, {
        name: 'Large team',
        slug: 'large-team',
      })
      await owner.t.run(async (ctx) => {
        for (let index = 0; index < 205; index += 1) {
          await ctx.db.insert('organizationInvitations', {
            organizationId,
            email: `invite-${index}@example.com`,
            role: 'member',
            invitedBy: owner.userId,
            expiresAt: Date.now() + 60_000,
          })
        }
      })
      await owner.t.mutation(internal.maintenance.deleteUserDataBatch, { userId: owner.userId })
      await expect(
        owner.asUser.mutation(api.organizations.setEntitlement, {
          organizationId,
          key: 'advanced',
          enabled: true,
        })
      ).rejects.toThrow('Organization access denied')
      await owner.t.finishAllScheduledFunctions(vi.runAllTimers)
      await owner.t.run(async (ctx) => {
        expect(await ctx.db.get(organizationId)).toBeNull()
        expect(await ctx.db.query('organizationInvitations').collect()).toEqual([])
        expect(await ctx.db.query('organizationAuditEvents').collect()).toEqual([])
        expect(await ctx.db.query('organizationMembers').collect()).toEqual([])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps invitations for unverified email claims and removes verified ones', async () => {
    const owner = await createAuthenticatedTest()
    const organizationId = await owner.asUser.mutation(api.organizations.create, {
      name: 'Acme',
      slug: 'acme',
    })
    await owner.asUser.mutation(api.organizations.invite, {
      organizationId,
      email: 'unverified@example.com',
      role: 'member',
    })
    await owner.asUser.mutation(api.organizations.invite, {
      organizationId,
      email: 'verified@example.com',
      role: 'member',
    })
    const unverified = await addUser(owner.t, 'unverified@example.com', false)
    const verified = await addUser(owner.t, 'verified@example.com', true)
    await owner.t.mutation(internal.maintenance.deleteUserDataBatch, { userId: unverified.userId })
    await owner.t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('organizationInvitations')
          .withIndex('by_email', (q) => q.eq('email', 'unverified@example.com'))
          .unique()
      ).not.toBeNull()
    })
    await owner.t.mutation(internal.maintenance.deleteUserDataBatch, {
      userId: verified.userId,
      email: 'verified@example.com',
    })
    await owner.t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('organizationInvitations')
          .withIndex('by_email', (q) => q.eq('email', 'verified@example.com'))
          .unique()
      ).toBeNull()
    })
  })
})
