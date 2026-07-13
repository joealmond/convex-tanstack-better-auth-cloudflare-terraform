import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // <convexkit:billing>
  billingSubscriptions: defineTable({
    ownerId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_customer', ['stripeCustomerId'])
    .index('by_subscription', ['stripeSubscriptionId']),

  stripeEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    processedAt: v.number(),
  }).index('by_event', ['eventId']),
  // </convexkit:billing>

  // <convexkit:email>
  emailDeliveries: defineTable({
    ownerId: v.string(),
    to: v.string(),
    kind: v.union(v.literal('welcome'), v.literal('test')),
    status: v.union(v.literal('queued'), v.literal('sent'), v.literal('error')),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_owner_kind', ['ownerId', 'kind']),
  // </convexkit:email>

  // <convexkit:ai>
  // Persisted output lets Convex subscriptions turn provider SSE into realtime UI updates.
  aiRuns: defineTable({
    ownerId: v.string(),
    prompt: v.string(),
    output: v.string(),
    status: v.union(
      v.literal('queued'),
      v.literal('streaming'),
      v.literal('completed'),
      v.literal('error')
    ),
    model: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),
  // </convexkit:ai>

  // <convexkit:todos>
  // Authenticated, realtime Todos example with cursor pagination.
  todos: defineTable({
    ownerId: v.string(),
    title: v.string(),
    completed: v.boolean(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),
  // </convexkit:todos>

  // <convexkit:chat>
  // Example messages table for Hello World demo
  messages: defineTable({
    content: v.string(),
    authorId: v.optional(v.string()),
    authorName: v.optional(v.string()),
  }).index('by_author', ['authorId']),
  // </convexkit:chat>

  // <convexkit:files>
  // File uploads example
  files: defineTable({
    storageId: v.id('_storage'),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    uploadedBy: v.optional(v.string()),
  })
    .index('by_uploader', ['uploadedBy'])
    .index('by_storage', ['storageId']),

  // Short-lived authorization records for the two-step direct upload flow.
  uploadIntents: defineTable({
    userId: v.string(),
    expiresAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_expiry', ['expiresAt']),

  // Transactionally maintained per-user quotas avoid an unbounded scan per upload.
  fileUsage: defineTable({
    userId: v.string(),
    totalBytes: v.number(),
    fileCount: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
  // </convexkit:files>
})
