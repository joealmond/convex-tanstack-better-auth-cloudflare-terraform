import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest, createTestBackend } from './test.utils'

describe('message mutations', () => {
  it('validates anonymous messages and stores normalized content', async () => {
    const t = createTestBackend()
    const id = await t.mutation(api.messages.send, {
      content: '  hello  ',
      anonymousId: 'anonymous-session-1234',
    })
    expect(await t.query(api.messages.list)).toMatchObject([
      { _id: id, content: 'hello', authorName: 'Anonymous' },
    ])
    await expect(
      t.mutation(api.messages.send, { content: 'x', anonymousId: 'short' })
    ).rejects.toThrow('Invalid anonymous session identifier')
  })

  it('lets an authenticated author remove their message and blocks non-admin deletion', async () => {
    const { asUser } = await createAuthenticatedTest()
    const id = await asUser.mutation(api.messages.send, { content: 'owned' })
    await expect(asUser.mutation(api.messages.deleteAny, { id })).rejects.toThrow(
      'Admin access required'
    )
    await asUser.mutation(api.messages.remove, { id })
    expect(await asUser.query(api.messages.list)).toEqual([])
  })
})
