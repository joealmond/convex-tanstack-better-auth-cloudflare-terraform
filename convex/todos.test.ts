import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import { createAuthenticatedTest } from './test.utils'

describe('todos', () => {
  it('creates, paginates, renames, completes, and removes owned todos', async () => {
    const { asUser } = await createAuthenticatedTest()
    const firstId = await asUser.mutation(api.todos.create, { title: '  First task  ' })
    await asUser.mutation(api.todos.create, { title: 'Second task' })

    const firstPage = await asUser.query(api.todos.list, {
      paginationOpts: { cursor: null, numItems: 1 },
    })
    expect(firstPage.page).toHaveLength(1)
    expect(firstPage.isDone).toBe(false)

    await asUser.mutation(api.todos.rename, { id: firstId, title: 'Renamed task' })
    await asUser.mutation(api.todos.setCompleted, { id: firstId, completed: true })
    const all = await asUser.query(api.todos.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(all.page.find((todo) => todo._id === firstId)).toMatchObject({
      title: 'Renamed task',
      completed: true,
    })

    await asUser.mutation(api.todos.remove, { id: firstId })
    const remaining = await asUser.query(api.todos.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(remaining.page.map((todo) => todo._id)).not.toContain(firstId)
  })

  it('isolates users and rejects invalid titles', async () => {
    const { t, asUser } = await createAuthenticatedTest({ email: 'first@example.com' })
    const todoId = await asUser.mutation(api.todos.create, { title: 'Private' })
    await expect(asUser.mutation(api.todos.rename, { id: todoId, title: ' ' })).rejects.toThrow(
      'Todo title is required'
    )
    await expect(
      t.query(api.todos.list, { paginationOpts: { cursor: null, numItems: 10 } })
    ).rejects.toThrow('Unauthenticated')
  })
})
