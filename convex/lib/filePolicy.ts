export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_USER_STORAGE_BYTES = 100 * 1024 * 1024
export const MAX_FILES_PER_USER = 100
export const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000

const ALLOWED_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/json',
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/markdown',
  'text/plain',
])

export type StoredFileMetadata = {
  size: number
  contentType?: string
}

export function validateFileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 255) {
    throw new Error('File name must be between 1 and 255 characters')
  }
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    [...trimmed].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  ) {
    throw new Error('File name contains unsupported characters')
  }
  return trimmed
}

export function validateStoredFile(metadata: StoredFileMetadata): {
  size: number
  contentType: string
} {
  if (!Number.isSafeInteger(metadata.size) || metadata.size <= 0) {
    throw new Error('Uploaded file is empty or has an invalid size')
  }
  if (metadata.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too large (maximum 10 MB)')
  }

  const contentType = metadata.contentType?.toLowerCase()
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('File type is not allowed')
  }

  return { size: metadata.size, contentType }
}

export function assertWithinStorageQuota(
  current: { totalBytes: number; fileCount: number },
  additionalBytes: number
): void {
  if (current.fileCount >= MAX_FILES_PER_USER) {
    throw new Error(`File quota reached (maximum ${MAX_FILES_PER_USER} files)`)
  }
  if (current.totalBytes + additionalBytes > MAX_USER_STORAGE_BYTES) {
    throw new Error('Storage quota reached (maximum 100 MB per user)')
  }
}
