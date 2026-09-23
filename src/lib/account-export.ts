type ExportPage = { page: unknown[]; isDone: boolean; continueCursor: string }

export async function collectAccountData(
  kinds: readonly string[],
  queryPage: (kind: string, cursor?: string) => Promise<ExportPage>,
  fetchFile: typeof fetch = fetch
) {
  // ponytail: this buffers the final JSON in the browser; stream to disk if account data outgrows browser memory.
  const data: Record<string, unknown[]> = {}
  for (const kind of kinds) {
    const records: unknown[] = []
    let cursor: string | undefined
    while (true) {
      const result = await queryPage(kind, cursor)
      for (const record of result.page) {
        if (kind !== 'files') {
          records.push(record)
          continue
        }
        const file = record as { downloadUrl: string | null; size: number }
        if (!file.downloadUrl) throw new Error('An uploaded file is unavailable for export')
        const response = await fetchFile(file.downloadUrl)
        if (!response.ok) throw new Error('An uploaded file could not be downloaded')
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.length !== file.size) throw new Error('An uploaded file is incomplete')
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
}

export async function downloadAccountData(
  kinds: readonly string[],
  queryPage: (kind: string, cursor?: string) => Promise<ExportPage>
) {
  const data = await collectAccountData(kinds, queryPage)
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
