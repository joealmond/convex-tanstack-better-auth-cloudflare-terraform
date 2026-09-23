import { ConvexError, v } from 'convex/values'
import { authQuery } from './lib/customFunctions'

const PAGE_SIZE = 100

export const page = authQuery({
  args: { kind: v.string(), cursor: v.optional(v.string()) },
  handler: async (ctx, { kind, cursor }) => {
    if (kind === 'account')
      return {
        page: [
          {
            id: ctx.userId,
            name: ctx.user.name,
            email: ctx.user.email,
            emailVerified: ctx.user.emailVerified,
          },
        ],
        isDone: true,
        continueCursor: '',
      }
    const options = { cursor: cursor ?? null, numItems: PAGE_SIZE }
    if (kind === 'organizations')
      return ctx.db
        .query('organizations')
        .withIndex('by_creator', (q) => q.eq('createdBy', ctx.userId))
        .paginate(options)
    if (kind === 'organizationMembers')
      return ctx.db
        .query('organizationMembers')
        .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
        .paginate(options)
    if (kind === 'organizationInvitations') {
      if (!ctx.user.emailVerified) return { page: [], isDone: true, continueCursor: '' }
      return ctx.db
        .query('organizationInvitations')
        .withIndex('by_email', (q) => q.eq('email', ctx.user.email.toLowerCase()))
        .paginate(options)
    }
    if (kind === 'sentInvitations')
      return ctx.db
        .query('organizationInvitations')
        .withIndex('by_inviter', (q) => q.eq('invitedBy', ctx.userId))
        .paginate(options)
    if (kind === 'organizationAuditEvents')
      return ctx.db
        .query('organizationAuditEvents')
        .withIndex('by_actor', (q) => q.eq('actorId', ctx.userId))
        .paginate(options)
    throw new ConvexError('Unsupported export kind')
  },
})
