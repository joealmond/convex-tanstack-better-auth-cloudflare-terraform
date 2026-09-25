import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

afterEach(() => vi.useRealTimers())

describe('files', () => {
  it('authorizes, records, lists, downloads, and deletes a stored file', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    const upload = await asUser.mutation(api.files.generateUploadUrl)
    expect(upload.uploadUrl).toContain('http')

    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
    )
    // convex-test does not currently persist a Blob's contentType in _storage,
    // so saveFile's metadata validation is covered in filePolicy.test.ts.
    const fileId = await t.run(async (ctx) => {
      const usage = await ctx.db
        .query('fileUsage')
        .withIndex('by_user', (query) => query.eq('userId', userId))
        .unique()
      if (!usage) throw new Error('Expected upload usage to exist')
      await ctx.db.patch(usage._id, {
        totalBytes: 5,
        fileCount: 1,
        updatedAt: Date.now(),
      })
      return await ctx.db.insert('files', {
        storageId,
        name: 'notes.txt',
        size: 5,
        type: 'text/plain',
        uploadedBy: userId,
      })
    })
    expect(await asUser.query(api.files.listMyFiles)).toMatchObject([
      { _id: fileId, name: 'notes.txt', size: 5, type: 'text/plain' },
    ])
    expect(await asUser.query(api.files.getDownloadUrl, { id: fileId })).toContain('http')

    await asUser.mutation(api.files.deleteFile, { id: fileId })
    expect(await asUser.query(api.files.listMyFiles)).toEqual([])
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull()
  })

  it('rejects an expired upload intent', async () => {
    const { t, asUser, userId } = await createAuthenticatedTest()
    const intentId = await t.run((ctx) =>
      ctx.db.insert('uploadIntents', { userId, expiresAt: Date.now() - 1 })
    )
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
    )
    await expect(
      asUser.mutation(api.files.saveFile, { intentId, storageId, name: 'notes.txt' })
    ).rejects.toThrow('Upload authorization expired')
  })
})

it('collects abandoned uploads across pages while preserving registered and recent files', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const { t, userId } = await createAuthenticatedTest()
  const ids = await t.run(async (ctx) => {
    const ids = []
    for (let i = 0; i < 105; i++) ids.push(await ctx.storage.store(new Blob(['orphan'])))
    await ctx.db.insert('files', {
      storageId: ids[0]!,
      name: 'keep.txt',
      type: 'text/plain',
      size: 6,
      uploadedBy: userId,
    })
    return ids
  })
  vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))
  const recent = await t.run((ctx) => ctx.storage.store(new Blob(['in flight'])))
  await t.mutation(internal.files.deleteAbandonedUploads, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  await t.run(async (ctx) => {
    expect(await ctx.storage.get(ids[0]!)).not.toBeNull()
    expect(await ctx.storage.get(recent)).not.toBeNull()
    for (const id of ids.slice(1)) expect(await ctx.storage.get(id)).toBeNull()
  })
})
