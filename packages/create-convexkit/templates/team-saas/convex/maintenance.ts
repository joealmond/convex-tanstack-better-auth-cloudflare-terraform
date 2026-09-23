import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

const BATCH_SIZE = 100

export const deleteExpiredData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_expiry', (q) => q.lt('expiresAt', Date.now()))
      .take(BATCH_SIZE)
    for (const invitation of expired) await ctx.db.delete(invitation._id)
    if (expired.length === BATCH_SIZE)
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteExpiredData)
  },
})

export const deleteOrganizationBatch = internalMutation({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    const organization = await ctx.db.get(organizationId)
    if (!organization?.deleting) return
    const invitations = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .take(BATCH_SIZE)
    for (const invitation of invitations) await ctx.db.delete(invitation._id)
    const entitlements = await ctx.db
      .query('organizationEntitlements')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .take(BATCH_SIZE)
    for (const entitlement of entitlements) await ctx.db.delete(entitlement._id)
    const events = await ctx.db
      .query('organizationAuditEvents')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .take(BATCH_SIZE)
    for (const event of events) await ctx.db.delete(event._id)
    const members = await ctx.db
      .query('organizationMembers')
      .withIndex('by_organization_user', (q) => q.eq('organizationId', organizationId))
      .take(BATCH_SIZE)
    for (const member of members) await ctx.db.delete(member._id)
    if ([invitations, entitlements, events, members].some((items) => items.length === BATCH_SIZE))
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteOrganizationBatch, {
        organizationId,
      })
    else await ctx.db.delete(organizationId)
  },
})

export const deleteUserDataBatch = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { userId, email }) => {
    const owned = await ctx.db
      .query('organizations')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .take(BATCH_SIZE)
    for (const organization of owned) {
      const admin = await ctx.db
        .query('organizationMembers')
        .withIndex('by_organization_role', (q) =>
          q.eq('organizationId', organization._id).eq('role', 'admin')
        )
        .first()
      const successor =
        admin ??
        (
          await ctx.db
            .query('organizationMembers')
            .withIndex('by_organization_user', (q) => q.eq('organizationId', organization._id))
            .take(2)
        ).find((member) => member.userId !== userId)
      if (successor) {
        await ctx.db.patch(successor._id, { role: 'owner' })
        await ctx.db.patch(organization._id, { createdBy: successor.userId })
      } else {
        await ctx.db.patch(organization._id, { createdBy: 'deleted-account', deleting: true })
        await ctx.scheduler.runAfter(0, internal.maintenance.deleteOrganizationBatch, {
          organizationId: organization._id,
        })
      }
    }
    const memberships = await ctx.db
      .query('organizationMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(BATCH_SIZE)
    for (const membership of memberships) await ctx.db.delete(membership._id)
    const invitations = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_inviter', (q) => q.eq('invitedBy', userId))
      .take(BATCH_SIZE)
    for (const invitation of invitations) await ctx.db.delete(invitation._id)
    let receivedCount = 0
    if (email) {
      const received = await ctx.db
        .query('organizationInvitations')
        .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
        .take(BATCH_SIZE)
      for (const invitation of received) await ctx.db.delete(invitation._id)
      receivedCount = received.length
    }
    const events = await ctx.db
      .query('organizationAuditEvents')
      .withIndex('by_actor', (q) => q.eq('actorId', userId))
      .take(BATCH_SIZE)
    for (const event of events) await ctx.db.patch(event._id, { actorId: 'deleted-account' })
    if (
      [owned.length, memberships.length, invitations.length, receivedCount, events.length].some(
        (count) => count === BATCH_SIZE
      )
    )
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, { userId, email })
  },
})
