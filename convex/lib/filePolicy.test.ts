import { describe, expect, it } from 'vitest'
import {
  assertWithinStorageQuota,
  MAX_FILE_SIZE_BYTES,
  validateFileName,
  validateStoredFile,
} from './filePolicy'

describe('file policy', () => {
  it('uses authoritative storage metadata for allowed files', () => {
    expect(validateStoredFile({ size: 128, contentType: 'image/png' })).toEqual({
      size: 128,
      contentType: 'image/png',
    })
  })

  it('rejects oversized and executable uploads', () => {
    expect(() =>
      validateStoredFile({ size: MAX_FILE_SIZE_BYTES + 1, contentType: 'image/png' })
    ).toThrow('File too large')
    expect(() => validateStoredFile({ size: 128, contentType: 'text/html' })).toThrow(
      'File type is not allowed'
    )
  })

  it('rejects path-like names and storage quota overflow', () => {
    expect(() => validateFileName('../secret.txt')).toThrow('unsupported characters')
    expect(() =>
      assertWithinStorageQuota({ totalBytes: 100 * 1024 * 1024, fileCount: 1 }, 1)
    ).toThrow('Storage quota reached')
  })
})
