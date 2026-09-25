import { afterEach, expect, it, vi } from 'vitest'
import { collectAccountData } from './account-export'

afterEach(() => vi.useRealTimers())

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

it('cancels a file download when the user cancels export', async () => {
  const controller = new AbortController()
  let started!: () => void
  const downloadStarted = new Promise<void>((resolve) => (started = resolve))
  const aborted = vi.fn()
  const fetchFile = vi.fn((_url: string, init?: RequestInit) => {
    started()
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted()
        reject(new Error('download aborted'))
      })
    })
  }) as typeof fetch
  const exportPromise = collectAccountData(
    ['files'],
    async () => ({
      page: [{ size: 5, downloadUrl: 'https://storage.example/file' }],
      isDone: true,
      continueCursor: '',
    }),
    fetchFile,
    { signal: controller.signal }
  )
  await downloadStarted
  controller.abort()
  await expect(exportPromise).rejects.toBeDefined()
  expect(aborted).toHaveBeenCalledOnce()
  expect(fetchFile).toHaveBeenCalledOnce()
})

it('stops export when canceled during an in-flight page query', async () => {
  const controller = new AbortController()
  let started!: () => void
  const queryStarted = new Promise<void>((resolve) => (started = resolve))
  const queryPage = vi.fn(() => {
    started()
    return new Promise<never>(() => {})
  })
  const exportPromise = collectAccountData(['todos'], queryPage, undefined, {
    signal: controller.signal,
  })
  await queryStarted
  controller.abort()
  await expect(exportPromise).rejects.toBeDefined()
  expect(queryPage).toHaveBeenCalledOnce()
})

it('times out a stalled page query', async () => {
  vi.useFakeTimers()
  let started!: () => void
  const queryStarted = new Promise<void>((resolve) => (started = resolve))
  const exportPromise = collectAccountData(
    ['todos'],
    () => {
      started()
      return new Promise(() => {})
    },
    undefined,
    { timeoutMs: 50 }
  )
  const failure = exportPromise.then(
    () => null,
    (error: unknown) => error
  )
  await queryStarted
  await vi.advanceTimersByTimeAsync(50)
  const error = await failure
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toContain('Data export timed out')
})

it('aborts the response body when canceled after download headers arrive', async () => {
  const controller = new AbortController()
  let started!: () => void
  const bodyStarted = new Promise<void>((resolve) => (started = resolve))
  const aborted = vi.fn()
  const fetchFile = vi.fn(async (_url: string, init?: RequestInit) => {
    init?.signal?.addEventListener('abort', aborted)
    return {
      ok: true,
      arrayBuffer: () => {
        started()
        return new Promise<ArrayBuffer>(() => {})
      },
    } as Response
  }) as typeof fetch
  const result = collectAccountData(
    ['files'],
    async () => ({
      page: [{ size: 5, downloadUrl: 'https://storage.example/file' }],
      isDone: true,
      continueCursor: '',
    }),
    fetchFile,
    { signal: controller.signal }
  )
  await bodyStarted
  controller.abort()
  await expect(result).rejects.toBeDefined()
  expect(aborted).toHaveBeenCalledOnce()
})
