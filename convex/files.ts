import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

// Generate an upload URL for file uploads
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Require authentication for uploads
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Must be authenticated to upload files')
    }

    return await ctx.storage.generateUploadUrl()
  },
})

// Save file metadata after upload
export const saveFile = mutation({
  args: {
    storageId: v.id('_storage'),
    name: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Must be authenticated to save files')
    }

    return await ctx.db.insert('files', {
      storageId: args.storageId,
      name: args.name,
      type: args.type,
      size: args.size,
      uploadedBy: identity.subject,
      createdAt: Date.now(),
    })
  },
})

// List user's files
export const listMyFiles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const files = await ctx.db
      .query('files')
      .withIndex('by_uploader', (q) => q.eq('uploadedBy', identity.subject))
      .collect()

    // Add download URLs
    return await Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await ctx.storage.getUrl(file.storageId),
      }))
    )
  },
})

// Delete a file
export const deleteFile = mutation({
  args: {
    id: v.id('files'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Must be authenticated')
    }

    const file = await ctx.db.get(args.id)
    if (!file) {
      throw new Error('File not found')
    }

    if (file.uploadedBy !== identity.subject) {
      throw new Error('Not authorized')
    }

    // Delete from storage and database
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)
  },
})
