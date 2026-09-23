import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

async function deleteOrganization(ctx: any, organizationId: any) {
  for (const table of ['organizationInvitations', 'organizationEntitlements', 'organizationAuditEvents'] as const) {
    const records = await ctx.db.query(table).withIndex('by_organization', (q: any) => q.eq('organizationId', organizationId)).collect()
    for (const record of records) await ctx.db.delete(record._id)
  }
  const members = await ctx.db.query('organizationMembers').withIndex('by_organization_user', (q: any) => q.eq('organizationId', organizationId)).collect()
  for (const member of members) await ctx.db.delete(member._id)
  await ctx.db.delete(organizationId)
}

export const deleteExpiredData = internalMutation({ args: {}, handler: async () => {} })

export const deleteUserDataBatch = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const owned = await ctx.db.query('organizations').withIndex('by_creator', (q) => q.eq('createdBy', userId)).collect()
    for (const organization of owned) {
      const members = await ctx.db.query('organizationMembers').withIndex('by_organization_user', (q) => q.eq('organizationId', organization._id)).collect()
      const successor = members.find((member) => member.userId !== userId && member.role === 'admin') ?? members.find((member) => member.userId !== userId)
      if (successor) await ctx.db.patch(successor._id, { role: 'owner' })
      else await deleteOrganization(ctx, organization._id)
    }
    const memberships = await ctx.db.query('organizationMembers').withIndex('by_user', (q) => q.eq('userId', userId)).collect()
    for (const membership of memberships) await ctx.db.delete(membership._id)
    const invitations = await ctx.db.query('organizationInvitations').collect()
    for (const invitation of invitations) if (invitation.invitedBy === userId) await ctx.db.delete(invitation._id)
  },
})
