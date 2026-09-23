import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

const MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 100

export const deleteExpiredData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const intents = await ctx.db
      .query('uploadIntents')
      .withIndex('by_expiry', (query) => query.lt('expiresAt', now))
      .take(BATCH_SIZE)
    for (const intent of intents) await ctx.db.delete(intent._id)

    const oldestMessages = await ctx.db.query('messages').order('asc').take(BATCH_SIZE)
    const expiredMessages = oldestMessages.filter(
      (message) => message._creationTime < now - MESSAGE_RETENTION_MS
    )
    for (const message of expiredMessages) await ctx.db.delete(message._id)

    if (intents.length === BATCH_SIZE || expiredMessages.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteExpiredData)
    }
  },
})

export const deleteUserDataBatch = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    let hasMore = false
    // <convexkit:files>
    const files = await ctx.db
      .query('files')
      .withIndex('by_uploader', (query) => query.eq('uploadedBy', userId))
      .take(BATCH_SIZE)
    for (const file of files) {
      await ctx.storage.delete(file.storageId)
      await ctx.db.delete(file._id)
    }
    hasMore ||= files.length === BATCH_SIZE
    // </convexkit:files>

    // <convexkit:chat>
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_author', (query) => query.eq('authorId', userId))
      .take(BATCH_SIZE)
    for (const message of messages) await ctx.db.delete(message._id)
    hasMore ||= messages.length === BATCH_SIZE
    // </convexkit:chat>

    // <convexkit:files>
    const intents = await ctx.db
      .query('uploadIntents')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .take(BATCH_SIZE)
    for (const intent of intents) await ctx.db.delete(intent._id)

    const usage = await ctx.db
      .query('fileUsage')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .unique()
    if (usage) await ctx.db.delete(usage._id)
    hasMore ||= intents.length === BATCH_SIZE
    // </convexkit:files>

    // <convexkit:todos>
    const todos = await ctx.db
      .query('todos')
      .withIndex('by_owner', (query) => query.eq('ownerId', userId))
      .take(BATCH_SIZE)
    for (const todo of todos) await ctx.db.delete(todo._id)
    hasMore ||= todos.length === BATCH_SIZE
    // </convexkit:todos>

    // <convexkit:ai>
    const aiRuns = await ctx.db
      .query('aiRuns')
      .withIndex('by_owner', (query) => query.eq('ownerId', userId))
      .take(BATCH_SIZE)
    for (const run of aiRuns) await ctx.db.delete(run._id)
    hasMore ||= aiRuns.length === BATCH_SIZE
    // </convexkit:ai>

    // <convexkit:email>
    const deliveries = await ctx.db
      .query('emailDeliveries')
      .withIndex('by_owner', (query) => query.eq('ownerId', userId))
      .take(BATCH_SIZE)
    for (const delivery of deliveries) await ctx.db.delete(delivery._id)
    hasMore ||= deliveries.length === BATCH_SIZE
    // </convexkit:email>

    // <convexkit:billing>
    const subscriptions = await ctx.db
      .query('billingSubscriptions')
      .withIndex('by_owner', (query) => query.eq('ownerId', userId))
      .take(BATCH_SIZE)
    for (const subscription of subscriptions) await ctx.db.delete(subscription._id)
    hasMore ||= subscriptions.length === BATCH_SIZE
    // </convexkit:billing>

    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, { userId })
    }
  },
})
