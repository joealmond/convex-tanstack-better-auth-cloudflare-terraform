import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

type Role = 'owner' | 'admin' | 'member'
const rank: Record<Role, number> = { owner: 3, admin: 2, member: 1 }

async function userId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Authentication required')
  return identity.subject
}

export async function requireOrganizationRole(ctx: any, organizationId: any, currentUserId: string, minimum: Role = 'member') {
  const membership = await ctx.db.query('organizationMembers').withIndex('by_organization_user', (q: any) => q.eq('organizationId', organizationId).eq('userId', currentUserId)).unique()
  if (!membership || rank[membership.role] < rank[minimum]) throw new ConvexError('Organization access denied')
  return membership
}

export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const createdBy = await userId(ctx)
    if (!/^[a-z0-9-]{3,64}$/.test(args.slug)) throw new ConvexError('Use a 3-64 character lowercase slug')
    if (await ctx.db.query('organizations').withIndex('by_slug', (q) => q.eq('slug', args.slug)).unique()) throw new ConvexError('Organization slug is already in use')
    const organizationId = await ctx.db.insert('organizations', { ...args, createdBy })
    await ctx.db.insert('organizationMembers', { organizationId, userId: createdBy, role: 'owner' })
    return organizationId
  },
})

export const mine = query({
  args: {}, handler: async (ctx) => {
    const currentUserId = await userId(ctx)
    return ctx.db.query('organizationMembers').withIndex('by_user', (q) => q.eq('userId', currentUserId)).collect()
  },
})

export const invite = mutation({
  args: { organizationId: v.id('organizations'), email: v.string(), role: v.union(v.literal('admin'), v.literal('member')) },
  handler: async (ctx, args) => {
    const invitedBy = await userId(ctx)
    await requireOrganizationRole(ctx, args.organizationId, invitedBy, 'admin')
    const email = args.email.trim().toLowerCase()
    const existing = await ctx.db.query('organizationInvitations').withIndex('by_organization_email', (q) => q.eq('organizationId', args.organizationId).eq('email', email)).unique()
    const values = { ...args, email, invitedBy, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }
    if (existing) await ctx.db.patch(existing._id, values)
    else await ctx.db.insert('organizationInvitations', values)
  },
})

export const acceptInvitation = mutation({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity?.email) throw new ConvexError('A verified email is required')
    const invitation = await ctx.db.query('organizationInvitations').withIndex('by_organization_email', (q) => q.eq('organizationId', organizationId).eq('email', identity.email!.toLowerCase())).unique()
    if (!invitation || invitation.expiresAt < Date.now()) throw new ConvexError('Invitation is invalid or expired')
    const userId = identity.subject
    if (!await ctx.db.query('organizationMembers').withIndex('by_organization_user', (q) => q.eq('organizationId', organizationId).eq('userId', userId)).unique()) await ctx.db.insert('organizationMembers', { organizationId, userId, role: invitation.role })
    await ctx.db.delete(invitation._id)
  },
})
