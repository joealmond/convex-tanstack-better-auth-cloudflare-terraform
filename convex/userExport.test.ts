import { expect, it } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

it('exports every owned table in pages without including another account', async () => {
  const { t, asUser, userId } = await createAuthenticatedTest()
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(['hello'], { type: 'text/plain' }))
  )
  await t.run(async (ctx) => {
    await ctx.db.insert('messages', { authorId: userId, content: 'mine' })
    await ctx.db.insert('messages', { authorId: 'another-user', content: 'private' })
    await ctx.db.insert('files', {
      storageId,
      uploadedBy: userId,
      name: 'notes.txt',
      type: 'text/plain',
      size: 5,
    })
    await ctx.db.insert('uploadIntents', { userId, expiresAt: Date.now() + 1_000 })
    await ctx.db.insert('fileUsage', { userId, totalBytes: 5, fileCount: 1, updatedAt: 0 })
    for (let index = 0; index < 101; index += 1)
      await ctx.db.insert('todos', {
        ownerId: userId,
        title: `todo-${index}`,
        completed: false,
        updatedAt: 0,
      })
    await ctx.db.insert('todos', {
      ownerId: 'another-user',
      title: 'private',
      completed: false,
      updatedAt: 0,
    })
    await ctx.db.insert('aiRuns', {
      ownerId: userId,
      prompt: 'prompt',
      output: 'answer',
      status: 'completed',
      updatedAt: 0,
    })
    await ctx.db.insert('emailDeliveries', {
      ownerId: userId,
      to: 'person@example.com',
      kind: 'test',
      status: 'sent',
      updatedAt: 0,
    })
    await ctx.db.insert('billingSubscriptions', { ownerId: userId, status: 'active', updatedAt: 0 })
  })

  const kinds = [
    'account',
    'messages',
    'files',
    'uploadIntents',
    'fileUsage',
    'aiRuns',
    'emailDeliveries',
    'billingSubscriptions',
  ]
  for (const kind of kinds) {
    const result = await asUser.query(api.userExport.page, { kind })
    expect(result.page, kind).toHaveLength(1)
  }
  const files = await asUser.query(api.userExport.page, { kind: 'files' })
  expect(files.page[0]).toMatchObject({
    name: 'notes.txt',
    downloadUrl: expect.stringContaining('http'),
  })
  const first = await asUser.query(api.userExport.page, { kind: 'todos' })
  expect(first.page).toHaveLength(100)
  expect(first.isDone).toBe(false)
  const second = await asUser.query(api.userExport.page, {
    kind: 'todos',
    cursor: first.continueCursor,
  })
  expect(second.page).toHaveLength(1)
  expect(second.isDone).toBe(true)
})
