import { query, mutation, type QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { requireAuth } from './lib/authHelpers'
import { authComponent } from './auth'
import type { AuthUser } from './lib/authHelpers'

/**
 * Safely get the authenticated user without throwing.
 * Returns null if not authenticated (important for public queries).
 */
async function getAuthUserSafe(ctx: QueryCtx): Promise<AuthUser | null> {
  try {
    return (await authComponent.getAuthUser(ctx)) as AuthUser | null
  } catch {
    return null
  }
}

// Generate an upload URL for file uploads
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Require authentication for uploads
    await requireAuth(ctx)
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
    const user = await requireAuth(ctx)

    return await ctx.db.insert('files', {
      storageId: args.storageId,
      name: args.name,
      type: args.type,
      size: args.size,
      uploadedBy: user._id,
      createdAt: Date.now(),
    })
  },
})

// List user's files
export const listMyFiles = query({
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

// Delete a file
export const deleteFile = mutation({
  args: {
    id: v.id('files'),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const file = await ctx.db.get(args.id)
    if (!file) {
      throw new Error('File not found')
    }

    if (file.uploadedBy !== user._id) {
      throw new Error('Not authorized to delete this file')
    }

    // Delete from storage and database
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)
  },
})
