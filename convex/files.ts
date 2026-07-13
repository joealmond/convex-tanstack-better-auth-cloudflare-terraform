import { ConvexError, v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { authMutation, authQuery } from './lib/customFunctions'
import {
  assertWithinStorageQuota,
  MAX_FILES_PER_USER,
  MAX_USER_STORAGE_BYTES,
  UPLOAD_INTENT_TTL_MS,
  validateFileName,
  validateStoredFile,
} from './lib/filePolicy'
import { rateLimiter } from './lib/services/rateLimitService'

async function getOrCreateUsage(ctx: MutationCtx, userId: string) {
  const existing = await ctx.db
    .query('fileUsage')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  if (existing) return existing

  // One-time reconciliation for deployments that predate the quota table.
  const existingFiles = await ctx.db
    .query('files')
    .withIndex('by_uploader', (q) => q.eq('uploadedBy', userId))
    .collect()
  const totalBytes = existingFiles.reduce((total, file) => total + file.size, 0)
  const usageId = await ctx.db.insert('fileUsage', {
    userId,
    totalBytes,
    fileCount: existingFiles.length,
    updatedAt: Date.now(),
  })
  const usage = await ctx.db.get(usageId)
  if (!usage) throw new Error('Failed to initialize file usage')
  return usage
}

export const generateUploadUrl = authMutation({
  args: {},
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, 'uploadFile', { key: ctx.userId, throws: true })
    const usage = await getOrCreateUsage(ctx, ctx.userId)
    if (usage.fileCount >= MAX_FILES_PER_USER || usage.totalBytes >= MAX_USER_STORAGE_BYTES) {
      throw new ConvexError('File storage quota reached')
    }

    const intentId = await ctx.db.insert('uploadIntents', {
      userId: ctx.userId,
      expiresAt: Date.now() + UPLOAD_INTENT_TTL_MS,
    })
    return { uploadUrl: await ctx.storage.generateUploadUrl(), intentId }
  },
})

export const saveFile = authMutation({
  args: {
    intentId: v.id('uploadIntents'),
    storageId: v.id('_storage'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId)
    if (!intent || intent.userId !== ctx.userId) {
      throw new ConvexError('Upload authorization is invalid')
    }
    if (intent.expiresAt < Date.now()) {
      await ctx.db.delete(args.intentId)
      throw new ConvexError('Upload authorization expired')
    }

    const duplicate = await ctx.db
      .query('files')
      .withIndex('by_storage', (q) => q.eq('storageId', args.storageId))
      .first()
    if (duplicate) throw new ConvexError('Uploaded file is already registered')

    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new ConvexError('Uploaded file was not found')

    let validated: ReturnType<typeof validateStoredFile>
    let name: string
    try {
      validated = validateStoredFile(metadata)
      name = validateFileName(args.name)
    } catch (error) {
      // The storage ID is unreferenced and belongs to this one-time upload flow.
      await ctx.storage.delete(args.storageId)
      await ctx.db.delete(args.intentId)
      throw new ConvexError(error instanceof Error ? error.message : 'Invalid uploaded file')
    }

    const usage = await getOrCreateUsage(ctx, ctx.userId)
    try {
      assertWithinStorageQuota(usage, validated.size)
    } catch (error) {
      await ctx.storage.delete(args.storageId)
      await ctx.db.delete(args.intentId)
      throw new ConvexError(error instanceof Error ? error.message : 'File storage quota reached')
    }

    const fileId = await ctx.db.insert('files', {
      storageId: args.storageId,
      name,
      type: validated.contentType,
      size: validated.size,
      uploadedBy: ctx.userId,
    })
    await ctx.db.patch(usage._id, {
      totalBytes: usage.totalBytes + validated.size,
      fileCount: usage.fileCount + 1,
      updatedAt: Date.now(),
    })
    await ctx.db.delete(args.intentId)
    return fileId
  },
})

export const listMyFiles = authQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('files')
      .withIndex('by_uploader', (q) => q.eq('uploadedBy', ctx.userId))
      .order('desc')
      .take(50)
  },
})

export const getDownloadUrl = authQuery({
  args: { id: v.id('files') },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id)
    if (!file || file.uploadedBy !== ctx.userId) {
      throw new ConvexError('File not found')
    }
    return await ctx.storage.getUrl(file.storageId)
  },
})

export const deleteFile = authMutation({
  args: { id: v.id('files') },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id)
    if (!file) throw new ConvexError('File not found')
    if (file.uploadedBy !== ctx.userId) {
      throw new ConvexError('Not authorized to delete this file')
    }

    await rateLimiter.limit(ctx, 'deleteFile', { key: ctx.userId, throws: true })
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)

    const usage = await ctx.db
      .query('fileUsage')
      .withIndex('by_user', (q) => q.eq('userId', ctx.userId))
      .unique()
    if (usage) {
      await ctx.db.patch(usage._id, {
        totalBytes: Math.max(0, usage.totalBytes - file.size),
        fileCount: Math.max(0, usage.fileCount - 1),
        updatedAt: Date.now(),
      })
    }
  },
})
