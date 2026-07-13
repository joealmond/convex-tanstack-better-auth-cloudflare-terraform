import { v } from 'convex/values'
import { internal } from './_generated/api'
import { authMutation, authQuery, internalMutation } from './lib/customFunctions'
import { rateLimiter } from './lib/services/rateLimitService'

export const listMine = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('emailDeliveries')
      .withIndex('by_owner', (query) => query.eq('ownerId', ctx.userId))
      .order('desc')
      .take(20)
  },
})

export const requestTest = authMutation({
  args: {},
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, 'sendEmail', { key: ctx.userId, throws: true })
    const deliveryId = await ctx.db.insert('emailDeliveries', {
      ownerId: ctx.userId,
      to: ctx.user.email,
      kind: 'test',
      status: 'queued',
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.emailActions.send, {
      deliveryId,
      ownerId: ctx.userId,
      to: ctx.user.email,
      name: ctx.user.name,
      kind: 'test',
    })
    return deliveryId
  },
})

export const enqueueWelcome = internalMutation({
  args: { ownerId: v.string(), to: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('emailDeliveries')
      .withIndex('by_owner_kind', (query) =>
        query.eq('ownerId', args.ownerId).eq('kind', 'welcome')
      )
      .first()
    if (existing) return existing._id

    const deliveryId = await ctx.db.insert('emailDeliveries', {
      ownerId: args.ownerId,
      to: args.to,
      kind: 'welcome',
      status: 'queued',
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.emailActions.send, {
      deliveryId,
      ownerId: args.ownerId,
      to: args.to,
      name: args.name,
      kind: 'welcome',
    })
    return deliveryId
  },
})

export const markSent = internalMutation({
  args: {
    deliveryId: v.id('emailDeliveries'),
    ownerId: v.string(),
    providerId: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery || delivery.ownerId !== args.ownerId) return
    await ctx.db.patch(args.deliveryId, {
      status: 'sent',
      providerId: args.providerId,
      error: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const markFailed = internalMutation({
  args: { deliveryId: v.id('emailDeliveries'), ownerId: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery || delivery.ownerId !== args.ownerId) return
    await ctx.db.patch(args.deliveryId, {
      status: 'error',
      error: args.error.slice(0, 500),
      updatedAt: Date.now(),
    })
  },
})
