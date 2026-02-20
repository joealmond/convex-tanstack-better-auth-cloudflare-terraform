# File Uploads Guide

Handle file uploads with Convex Storage and create drag-and-drop UI components.

## Quick Start

Convex Storage is already configured in this template! You just need to build the UI.

### Basic Upload Flow

```typescript
// 1. Generate upload URL (backend)
// convex/files.ts - Already in template!
export const generateUploadUrl = authMutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// 2. Upload file (frontend)
async function uploadFile(file: File) {
  // Get upload URL from Convex
  const uploadUrl = await api.files.generateUploadUrl()

  // Upload file to Convex Storage
  const result = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })

  const { storageId } = await result.json()

  // Save metadata
  await api.files.saveFile({
    storageId,
    name: file.name,
    type: file.type,
    size: file.size,
  })
}
```

## Drag-and-Drop Component

```typescript
// src/components/FileUpload.tsx
import { useCallback, useState } from 'react'
import { useConvexMutation } from '@/lib/patterns/useConvexMutation'
import { api } from '@/convex/_generated/api'
import { Upload, X, CheckCircle } from 'lucide-react'

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...droppedFiles])
  }, [])

  const handleUpload = async () => {
    setUploading(true)

    for (const file of files) {
      try {
        // 1. Generate upload URL
        const uploadUrl = await api.files.generateUploadUrl()

        // 2. Upload to Convex Storage
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        const { storageId } = await result.json()

        // 3. Save metadata
        await api.files.saveFile({
          storageId,
          name: file.name,
          type: file.type,
          size: file.size,
        })

        setUploadedFiles((prev) => [...prev, file.name])
      } catch (error) {
        console.error('Upload failed:', error)
      }
    }

    setUploading(false)
    setFiles([])
  }

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors"
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to select
        </p>
        <input
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              setFiles(Array.from(e.target.files))
            }
          }}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Files to upload:</h3>
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{file.name} ({formatFileSize(file.size)})</span>
                <button
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Uploaded successfully:
          </h3>
          <ul className="space-y-1">
            {uploadedFiles.map((name, i) => (
              <li key={i} className="text-green-600">{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
```

## Progress Tracking

```typescript
// src/components/FileUploadWithProgress.tsx
export function FileUploadWithProgress() {
  const [progress, setProgress] = useState<Record<string, number>>({})

  const uploadWithProgress = async (file: File) => {
    const uploadUrl = await api.files.generateUploadUrl()

    const xhr = new XMLHttpRequest()

    // Track progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentage = (e.loaded / e.total) * 100
        setProgress((prev) => ({ ...prev, [file.name]: percentage }))
      }
    })

    // Upload
    await new Promise((resolve, reject) => {
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.onload = () => resolve(xhr.response)
      xhr.onerror = reject
      xhr.send(file)
    })

    const { storageId } = JSON.parse(xhr.response)

    // Save metadata
    await api.files.saveFile({
      storageId,
      name: file.name,
      type: file.type,
      size: file.size,
    })
  }

  return (
    <div>
      {Object.entries(progress).map(([name, pct]) => (
        <div key={name}>
          <span>{name}</span>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span>{pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}
```

## Image Preview

```typescript
export function ImageUpload() {
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileSelect(e.target.files[0])
          }
        }}
      />
      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="mt-4 max-w-sm rounded-lg"
        />
      )}
    </div>
  )
}
```

## File Type Restrictions

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `File type ${file.type} not allowed`
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds ${formatFileSize(MAX_FILE_SIZE)}`
  }

  return null
}

// Usage
const error = validateFile(file)
if (error) {
  toast.error(error)
  return
}
```

## Rate Limiting

Apply rate limiting to uploads:

```typescript
// convex/files.ts
import { withFileUploadLimit } from './lib/middleware/withRateLimit'

export const saveFile = authMutation({
  args: {
    /* ... */
  },
  handler: withFileUploadLimit(async (ctx, args, user) => {
    return await ctx.db.insert('files', {
      ...args,
      uploadedBy: user._id,
      uploadedAt: Date.now(),
    })
  }),
})
```

## Delete Files

```typescript
// Frontend
async function deleteFile(fileId: Id<'files'>) {
  await api.files.deleteFile({ id: fileId })
}

// Backend (already in template)
export const deleteFile = authMutation({
  args: { id: v.id('files') },
  handler: async (ctx, args) => {
    // ctx.user and ctx.userId are auto-injected by authMutation
    const file = await ctx.db.get(args.id)

    if (file.uploadedBy !== ctx.userId) {
      throw new ConvexError('Not authorized')
    }

    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)
  },
})
```

## Best Practices

- ✅ Validate file types and sizes
- ✅ Show upload progress
- ✅ Apply rate limiting
- ✅ Clean up failed uploads
- ✅ Use image previews
- ✅ Handle errors gracefully
- ❌ Don't allow unlimited file sizes
- ❌ Don't skip validation
- ❌ Don't forget to delete storage when deleting records

---

## Storage Alternatives

Convex native storage works great for most apps. For larger-scale needs, consider alternatives:

| Solution            | Cost      | Best For                      |
| ------------------- | --------- | ----------------------------- |
| **Convex Native**   | $0.033/GB | <1 GB, simple setup           |
| **Cloudflare R2**   | $0.015/GB | Already on Cloudflare         |
| **Bunny.net (CDN)** | $0.01/GB  | Global CDN, large media       |
| **Transloadit**     | $69/mo    | Video processing, transcoding |

For most template users, Convex native storage is the right choice. Switch to R2 if you're already on Cloudflare and need cheaper storage at scale.

## Examples

See working examples in:

- `convex/files.ts` — Backend mutations for upload, save, list, delete
- `src/routes/files.tsx` — Frontend upload UI with progress
