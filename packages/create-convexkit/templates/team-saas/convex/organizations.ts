import { ConvexError, v } from 'convex/values'
import { authMutation, authQuery } from './lib/customFunctions'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type Role = 'owner' | 'admin' | 'member'
const rank: Record<Role, number> = { owner: 3, admin: 2, member: 1 }

export async function requireOrganizationRole(
  ctx: Pick<QueryCtx, 'db'>,
  organizationId: Id<'organizations'>,
  userId: string,
  minimum: Role = 'member'
) {
  const membership = await ctx.db
    .query('organizationMembers')
    .withIndex('by_organization_user', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId)
    )
    .unique()
  if (!membership || rank[membership.role] < rank[minimum])
    throw new ConvexError('Organization access denied')
  return membership
}

async function audit(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  actorId: string,
  event: string
) {
  await ctx.db.insert('organizationAuditEvents', {
    organizationId,
    actorId,
    event,
    createdAt: Date.now(),
  })
}

export const create = authMutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    if (!/^[a-z0-9-]{3,64}$/.test(args.slug))
      throw new ConvexError('Use a 3-64 character lowercase slug')
    if (
      await ctx.db
        .query('organizations')
        .withIndex('by_slug', (q) => q.eq('slug', args.slug))
        .unique()
    )
      throw new ConvexError('Organization slug is already in use')
    const organizationId = await ctx.db.insert('organizations', { ...args, createdBy: ctx.userId })
    await ctx.db.insert('organizationMembers', {
      organizationId,
      userId: ctx.userId,
      role: 'owner',
    })
    await audit(ctx, organizationId, ctx.userId, 'organization.created')
    return organizationId
  },
})

export const mine = authQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query('organizationMembers')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .collect()
    return Promise.all(
      memberships.map(async (membership) => ({
        ...membership,
        organization: await ctx.db.get(membership.organizationId),
      }))
    )
  },
})

export const myInvitations = authQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user.emailVerified) return []
    const invitations = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_email', (q) => q.eq('email', ctx.user.email.toLowerCase()))
      .collect()
    return Promise.all(
      invitations
        .filter((invitation) => invitation.expiresAt > Date.now())
        .map(async (invitation) => ({
          ...invitation,
          organization: await ctx.db.get(invitation.organizationId),
        }))
    )
  },
})

export const invite = authMutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    await requireOrganizationRole(ctx, args.organizationId, ctx.userId, 'admin')
    const email = args.email.trim().toLowerCase()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError('Enter a valid email address')
    }
    const existing = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_organization_email', (q) =>
        q.eq('organizationId', args.organizationId).eq('email', email)
      )
      .unique()
    const values = {
      ...args,
      email,
      invitedBy: ctx.userId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }
    if (existing) await ctx.db.patch(existing._id, values)
    else await ctx.db.insert('organizationInvitations', values)
    await audit(ctx, args.organizationId, ctx.userId, 'member.invited')
  },
})

export const acceptInvitation = authMutation({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    if (!ctx.user.emailVerified) throw new ConvexError('A verified email is required')
    const invitation = await ctx.db
      .query('organizationInvitations')
      .withIndex('by_organization_email', (q) =>
        q.eq('organizationId', organizationId).eq('email', ctx.user.email.toLowerCase())
      )
      .unique()
    if (!invitation || invitation.expiresAt < Date.now())
      throw new ConvexError('Invitation is invalid or expired')
    if (
      !(await ctx.db
        .query('organizationMembers')
        .withIndex('by_organization_user', (q) =>
          q.eq('organizationId', organizationId).eq('userId', ctx.userId)
        )
        .unique())
    )
      await ctx.db.insert('organizationMembers', {
        organizationId,
        userId: ctx.userId,
        role: invitation.role,
      })
    await ctx.db.delete(invitation._id)
    await audit(ctx, organizationId, ctx.userId, 'invitation.accepted')
  },
})

export const setEntitlement = authMutation({
  args: { organizationId: v.id('organizations'), key: v.string(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireOrganizationRole(ctx, args.organizationId, ctx.userId, 'admin')
    const existing = await ctx.db
      .query('organizationEntitlements')
      .withIndex('by_organization_key', (q) =>
        q.eq('organizationId', args.organizationId).eq('key', args.key)
      )
      .unique()
    if (existing) await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: Date.now() })
    else await ctx.db.insert('organizationEntitlements', { ...args, updatedAt: Date.now() })
    await audit(ctx, args.organizationId, ctx.userId, 'entitlement.updated')
  },
})

export const hasEntitlement = authQuery({
  args: { organizationId: v.id('organizations'), key: v.string() },
  handler: async (ctx, args) => {
    await requireOrganizationRole(ctx, args.organizationId, ctx.userId)
    return (
      (
        await ctx.db
          .query('organizationEntitlements')
          .withIndex('by_organization_key', (q) =>
            q.eq('organizationId', args.organizationId).eq('key', args.key)
          )
          .unique()
      )?.enabled ?? false
    )
  },
})
