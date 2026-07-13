import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Example messages table for Hello World demo
  messages: defineTable({
    content: v.string(),
    authorId: v.optional(v.string()),
    authorName: v.optional(v.string()),
  }).index('by_author', ['authorId']),

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
})
