# File Uploads Guide

The files example uses authenticated, two-step uploads to Convex Storage. See
`convex/files.ts` for the backend and
`src/components/examples/FileUploadsExample.tsx` for the runnable UI.

## Upload contract

1. Call `generateUploadUrl` as the signed-in user. It checks issuance limits and
   returns `{ uploadUrl, intentId }`. The one-time intent expires after 15 minutes.
2. POST the file to `uploadUrl`; the response contains `storageId`.
3. Call `saveFile({ intentId, storageId, name })`. The backend reads size and MIME
   type from storage, validates the filename, and enforces account quotas.

`saveFile` returns the file ID on success. A rejected upload returns
`{ rejected: true, reason: string }` after deleting its unregistered blob and
intent. Callers must handle that result; resolving the mutation lets Convex
commit the cleanup. Throwing after cleanup would roll the writes back.
Unauthorized intents and already-registered storage IDs still throw, preserving
other users' registered files.

The current component runs its upload workflow with Effect at the React event
handler boundary. Keep that pattern when adding drag-and-drop or batch upload:

```tsx
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

function UploadButton() {
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const saveFile = useConvexMutation(api.files.saveFile)

  async function upload(file: File) {
    const Effect = await import('@/lib/effect-runtime')
    return Effect.runPromise(
      Effect.gen(function* () {
        const { uploadUrl, intentId } = yield* Effect.tryPromise({
          try: () => generateUploadUrl({}),
          catch: (error) => error,
        })
        const storageId = yield* Effect.tryPromise({
          try: async (signal) => {
            const response = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': file.type },
              body: file,
              signal,
            })
            if (!response.ok) throw new Error('Upload failed')
            const body: unknown = await response.json()
            if (
              typeof body !== 'object' ||
              body === null ||
              !('storageId' in body) ||
              typeof body.storageId !== 'string' ||
              !body.storageId
            )
              throw new Error('Invalid upload response')
            return body.storageId as Id<'_storage'>
          },
          catch: (error) => error,
        })
        const saved = yield* Effect.tryPromise({
          try: () => saveFile({ intentId, storageId, name: file.name }),
          catch: (error) => error,
        })
        if (typeof saved === 'object') {
          return yield* Effect.fail(new Error(saved.reason))
        }
        return saved
      })
    )
  }

  return (
    <input
      type="file"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void upload(file).catch((error) => console.error('Upload failed', error))
      }}
    />
  )
}
```

For a product UI, disable input while uploading and show errors with the existing
notification pattern. An uncertain transfer is not automatically retried: storage
may have accepted bytes before the browser receives a storage ID.

## Download and deletion

`listMyFiles` returns owner-scoped metadata. Call `getDownloadUrl({ id })` for an
owned file; storage download URLs are bearer URLs, so share them only deliberately.
`deleteFile({ id })` verifies ownership, deletes the blob and metadata, and updates
quota counters in one mutation. Account export includes file bytes, and confirmed
account deletion queues file cleanup.

## Quotas and abandoned uploads

The 10 MB per-file limit, 100-file limit, and 100 MB account quota are enforced
when registering metadata. Direct-upload URLs do not enforce byte limits before
storage accepts a transfer; these limits are not a hard billing cap. Issuance is
rate limited. Validation/quota rejections delete known blobs immediately.

An hourly job deletes unregistered objects older than 24 hours in bounded pages,
including transfers whose client never calls `saveFile`. Registered and recent
files are preserved. Storage currently belongs exclusively to `files`; extend
its reference checks before another feature stores blobs.

For a strict byte limit before transfer, use a controlled HTTP upload endpoint.
Issuance limits and cleanup cannot prevent costs already incurred by a transfer.
