import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Example messages table for Hello World demo
  messages: defineTable({
    content: v.string(),
    authorId: v.optional(v.string()),
    authorName: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created', ['createdAt']),

  // File uploads example
  files: defineTable({
    storageId: v.id('_storage'),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    uploadedBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_uploader', ['uploadedBy']),
})
