import { expect, it, vi } from 'vitest'
import { collectAccountData } from './account-export'

it('collects every page and embeds file bytes without retaining signed URLs', async () => {
  const queryPage = vi.fn(async (kind: string, cursor?: string) => {
    if (kind === 'todos')
      return cursor
        ? { page: [{ title: 'second' }], isDone: true, continueCursor: '' }
        : { page: [{ title: 'first' }], isDone: false, continueCursor: 'next' }
    return {
      page: [{ name: 'notes.txt', size: 5, downloadUrl: 'https://storage.example/file' }],
      isDone: true,
      continueCursor: '',
    }
  })
  const fetchFile = vi.fn().mockResolvedValue(new Response('hello')) as typeof fetch
  const data = await collectAccountData(['todos', 'files'], queryPage, fetchFile)
  expect(data.todos).toHaveLength(2)
  expect(data.files).toMatchObject([{ name: 'notes.txt', contentBase64: 'aGVsbG8=' }])
  expect(JSON.stringify(data)).not.toContain('https://storage.example/file')
  expect(queryPage).toHaveBeenCalledTimes(3)
  expect(fetchFile).toHaveBeenCalledOnce()
})

it('fails the export if an uploaded file cannot be included', async () => {
  await expect(
    collectAccountData(['files'], async () => ({
      page: [{ size: 5, downloadUrl: null }],
      isDone: true,
      continueCursor: '',
    }))
  ).rejects.toThrow('unavailable')
})
