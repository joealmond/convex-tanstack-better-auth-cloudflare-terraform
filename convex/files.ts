import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { authMutation, publicQuery } from './lib/customFunctions'
import { getAuthUserSafe } from './lib/authHelpers'

// Generate an upload URL for file uploads
// ctx.user injected by authMutation — authentication is required
export const generateUploadUrl = authMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Save file metadata after upload
// ctx.user and ctx.userId injected by authMutation
export const saveFile = authMutation({
  args: {
    storageId: v.id('_storage'),
    name: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('files', {
      storageId: args.storageId,
      name: args.name,
      type: args.type,
      size: args.size,
      uploadedBy: ctx.userId,
    })
  },
})

// List user's files (SSR-safe — returns [] if not authenticated)
export const listMyFiles = publicQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserSafe(ctx)
    if (!user) {
      return []
    }

    const files = await ctx.db
      .query('files')
      .withIndex('by_uploader', (q) => q.eq('uploadedBy', user._id))
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

// Delete a file (owner only)
// ctx.user and ctx.userId injected by authMutation
export const deleteFile = authMutation({
  args: {
    id: v.id('files'),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id)
    if (!file) {
      throw new ConvexError('File not found')
    }

    if (file.uploadedBy !== ctx.userId) {
      throw new ConvexError('Not authorized to delete this file')
    }

    // Delete from storage and database
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)
  },
})
