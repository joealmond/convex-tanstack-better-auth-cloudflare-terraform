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
    const paginationOpts = { cursor: cursor ?? null, numItems: PAGE_SIZE }
    // <convexkit:chat>
    if (kind === 'messages')
      return ctx.db
        .query('messages')
        .withIndex('by_author', (q) => q.eq('authorId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:chat>
    // <convexkit:files>
    if (kind === 'files') {
      const result = await ctx.db
        .query('files')
        .withIndex('by_uploader', (q) => q.eq('uploadedBy', ctx.userId))
        .paginate(paginationOpts)
      return {
        ...result,
        page: await Promise.all(
          result.page.map(async (file) => ({
            ...file,
            downloadUrl: await ctx.storage.getUrl(file.storageId),
          }))
        ),
      }
    }
    if (kind === 'uploadIntents')
      return ctx.db
        .query('uploadIntents')
        .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
        .paginate(paginationOpts)
    if (kind === 'fileUsage')
      return ctx.db
        .query('fileUsage')
        .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:files>
    // <convexkit:todos>
    if (kind === 'todos')
      return ctx.db
        .query('todos')
        .withIndex('by_owner', (q) => q.eq('ownerId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:todos>
    // <convexkit:ai>
    if (kind === 'aiRuns')
      return ctx.db
        .query('aiRuns')
        .withIndex('by_owner', (q) => q.eq('ownerId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:ai>
    // <convexkit:email>
    if (kind === 'emailDeliveries')
      return ctx.db
        .query('emailDeliveries')
        .withIndex('by_owner', (q) => q.eq('ownerId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:email>
    // <convexkit:billing>
    if (kind === 'billingSubscriptions')
      return ctx.db
        .query('billingSubscriptions')
        .withIndex('by_owner', (q) => q.eq('ownerId', ctx.userId))
        .paginate(paginationOpts)
    // </convexkit:billing>
    throw new ConvexError('Unsupported export kind')
  },
})
