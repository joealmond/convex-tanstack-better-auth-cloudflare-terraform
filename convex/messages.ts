import { query, mutation, type MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { requireAuth, requireAdmin } from './lib/authHelpers'
import { authComponent } from './auth'
import { RateLimitService } from './lib/services/rateLimitService'

// List all messages (public)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('messages').withIndex('by_created').order('desc').take(50)
  },
})

// Send a new message (anyone can send, rate limited)
export const send = mutation({
  args: {
    content: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    // Get user if authenticated (but don't require it)
    let user = null
    try {
      user = await authComponent.getAuthUser(ctx)
    } catch {
      // Not authenticated, that's ok
    }

    // Rate limit: use user ID if authenticated, otherwise use a generic key
    const rateLimitKey = user?._id || 'anonymous'
    const rateLimitService = new RateLimitService(ctx)
    await rateLimitService.checkLimit('SEND_MESSAGE', rateLimitKey, user ? 'user' : 'guest')

    return await ctx.db.insert('messages', {
      content: args.content,
      authorId: user?._id,
      authorName: user?.name ?? 'Anonymous',
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
