type ExportPage = { page: unknown[]; isDone: boolean; continueCursor: string }
const DEFAULT_EXPORT_TIMEOUT_MS = 5 * 60_000
type ExportOptions = { signal?: AbortSignal; timeoutMs?: number }

export async function collectAccountData(
  kinds: readonly string[],
  queryPage: (kind: string, cursor?: string) => Promise<ExportPage>,
  fetchFile: typeof fetch = fetch,
  options: ExportOptions = {}
) {
  const Effect = await import('./effect-runtime')
  const program = Effect.gen(function* () {
    // ponytail: this buffers the final JSON in the browser; stream to disk if account data outgrows browser memory.
    const data: Record<string, unknown[]> = {}
    for (const kind of kinds) {
      const records: unknown[] = []
      let cursor: string | undefined
      while (true) {
        const result = yield* Effect.tryPromise({
          try: () => queryPage(kind, cursor),
          catch: (error) => error,
        })
        for (const record of result.page) {
          if (kind !== 'files') {
            records.push(record)
            continue
          }
          const file = record as { downloadUrl: string | null; size: number }
          const downloadUrl = file.downloadUrl
          if (!downloadUrl)
            return yield* Effect.fail(new Error('An uploaded file is unavailable for export'))
          // Keep the fetch signal alive until the body is fully consumed.
          const bytes = new Uint8Array(
            yield* Effect.tryPromise({
              try: async (signal) => {
                const response = await fetchFile(downloadUrl, { signal })
                if (!response.ok) {
                  await response.body?.cancel()
                  throw new Error('An uploaded file could not be downloaded')
                }
                return response.arrayBuffer()
              },
              catch: (error) => error,
            })
          )
          if (bytes.length !== file.size)
            return yield* Effect.fail(new Error('An uploaded file is incomplete'))
          const chunks: string[] = []
          for (let offset = 0; offset < bytes.length; offset += 32_768)
            chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)))
          records.push({ ...file, downloadUrl: undefined, contentBase64: btoa(chunks.join('')) })
        }
        if (result.isDone) break
        cursor = result.continueCursor
      }
      data[kind] = records
    }
    return data
  }).pipe(
    Effect.timeoutFail({
      duration: options.timeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS,
      onTimeout: () => new Error('Data export timed out'),
    })
  )
  return Effect.runPromise(program, { signal: options.signal })
}

export async function downloadAccountData(
  kinds: readonly string[],
  queryPage: (kind: string, cursor?: string) => Promise<ExportPage>,
  options: ExportOptions = {}
) {
  const data = await collectAccountData(kinds, queryPage, fetch, options)
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data })], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `account-data-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
