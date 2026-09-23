import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function deleteOrganization(ctx: MutationCtx, organizationId: Id<'organizations'>) {
  const invitations = await ctx.db
    .query('organizationInvitations')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect()
  for (const invitation of invitations) await ctx.db.delete(invitation._id)
  const entitlements = await ctx.db
    .query('organizationEntitlements')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect()
  for (const entitlement of entitlements) await ctx.db.delete(entitlement._id)
  const events = await ctx.db
    .query('organizationAuditEvents')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect()
  for (const event of events) await ctx.db.delete(event._id)
  const members = await ctx.db
    .query('organizationMembers')
    .withIndex('by_organization_user', (q) => q.eq('organizationId', organizationId))
    .collect()
  for (const member of members) await ctx.db.delete(member._id)
  await ctx.db.delete(organizationId)
}

export const deleteExpiredData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_expiry', (q) => q.lt('expiresAt', Date.now()))
      .take(100)
    for (const invitation of expired) await ctx.db.delete(invitation._id)
    if (expired.length === 100)
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteExpiredData)
  },
})

export const deleteUserDataBatch = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { userId, email }) => {
    const owned = await ctx.db
      .query('organizations')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .collect()
    for (const organization of owned) {
      const members = await ctx.db
        .query('organizationMembers')
        .withIndex('by_organization_user', (q) => q.eq('organizationId', organization._id))
        .collect()
      const successor =
        members.find((member) => member.userId !== userId && member.role === 'admin') ??
        members.find((member) => member.userId !== userId)
      if (successor) {
        await ctx.db.patch(successor._id, { role: 'owner' })
        await ctx.db.patch(organization._id, { createdBy: successor.userId })
      } else await deleteOrganization(ctx, organization._id)
    }
    const memberships = await ctx.db
      .query('organizationMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    for (const membership of memberships) await ctx.db.delete(membership._id)
    const invitations = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_inviter', (q) => q.eq('invitedBy', userId))
      .collect()
    for (const invitation of invitations) await ctx.db.delete(invitation._id)
    if (email) {
      const received = await ctx.db
        .query('organizationInvitations')
        .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
        .collect()
      for (const invitation of received) await ctx.db.delete(invitation._id)
    }
    const events = await ctx.db
      .query('organizationAuditEvents')
      .withIndex('by_actor', (q) => q.eq('actorId', userId))
      .collect()
    for (const event of events) await ctx.db.patch(event._id, { actorId: 'deleted-account' })
  },
})
