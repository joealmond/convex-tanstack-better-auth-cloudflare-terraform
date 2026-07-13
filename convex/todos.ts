import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { authMutation, authQuery } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'

const MAX_TITLE_LENGTH = 160

function normalizeTitle(value: string) {
  const title = value.trim()
  if (!title) throw new ConvexError('Todo title is required')
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ConvexError(`Todo title must be ${MAX_TITLE_LENGTH} characters or fewer`)
  }
  return title
}

export const list = authQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query('todos')
      .withIndex('by_owner', (query) => query.eq('ownerId', ctx.userId))
      .order('desc')
      .paginate(paginationOpts)
  },
})

export const create = authMutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    await rateLimiter.limit(ctx, 'todoWrite', { key: ctx.userId, throws: true })
    return await ctx.db.insert('todos', {
      ownerId: ctx.userId,
      title: normalizeTitle(title),
      completed: false,
      updatedAt: Date.now(),
    })
  },
})

export const setCompleted = authMutation({
  args: { id: v.id('todos'), completed: v.boolean() },
  handler: async (ctx, { id, completed }) => {
    await rateLimiter.limit(ctx, 'todoWrite', { key: ctx.userId, throws: true })
    const todo = await ctx.db.get(id)
    if (!todo || todo.ownerId !== ctx.userId) throw new ConvexError('Todo not found')
    await ctx.db.patch(id, { completed, updatedAt: Date.now() })
  },
})

export const rename = authMutation({
  args: { id: v.id('todos'), title: v.string() },
  handler: async (ctx, { id, title }) => {
    await rateLimiter.limit(ctx, 'todoWrite', { key: ctx.userId, throws: true })
    const todo = await ctx.db.get(id)
    if (!todo || todo.ownerId !== ctx.userId) throw new ConvexError('Todo not found')
    await ctx.db.patch(id, { title: normalizeTitle(title), updatedAt: Date.now() })
  },
})

export const remove = authMutation({
  args: { id: v.id('todos') },
  handler: async (ctx, { id }) => {
    await rateLimiter.limit(ctx, 'todoWrite', { key: ctx.userId, throws: true })
    const todo = await ctx.db.get(id)
    if (!todo || todo.ownerId !== ctx.userId) throw new ConvexError('Todo not found')
    await ctx.db.delete(id)
  },
})
