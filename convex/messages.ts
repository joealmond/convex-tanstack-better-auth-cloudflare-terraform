import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireAuth, requireAdmin } from './lib/authHelpers'

// List all messages (public)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('messages').withIndex('by_created').order('desc').take(50)
  },
})

// Send a new message (authenticated users only)
export const send = mutation({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Require authentication
    const user = await requireAuth(ctx)

    return await ctx.db.insert('messages', {
      content: args.content,
      authorId: user._id,
      authorName: user.name ?? 'Anonymous',
      createdAt: Date.now(),
    })
  },
})

// Delete own message (author only)
export const remove = mutation({
  args: {
    id: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const message = await ctx.db.get(args.id)
    if (!message) {
      throw new Error('Message not found')
    }

    if (message.authorId !== user._id) {
      throw new Error('Not authorized to delete this message')
    }

    await ctx.db.delete(args.id)
  },
})

// Delete any message (admin only)
// Example of admin-only mutation using RBAC
export const deleteAny = mutation({
  args: {
    id: v.id('messages'),
  },
  handler: async (ctx, args) => {
    // Only admins can delete any message
    await requireAdmin(ctx)

    const message = await ctx.db.get(args.id)
    if (!message) {
      throw new Error('Message not found')
    }

    await ctx.db.delete(args.id)
  },
})
