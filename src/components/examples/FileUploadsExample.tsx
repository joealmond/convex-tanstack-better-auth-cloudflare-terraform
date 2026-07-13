import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSession } from '@/lib/use-auth-session'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import { Upload, File, Trash2, ArrowLeft, Loader2, Download } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Id } from '@convex/_generated/dataModel'
import { toast } from 'sonner'
import { useConvex } from 'convex/react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type FileUploadsExampleProps = {
  backTo?: '/' | '/examples'
}

export function FileUploadsExample({ backTo = '/' }: FileUploadsExampleProps) {
  const { data: session, isPending: isSessionLoading } = useSession()
  const { data: files, isLoading: isFilesLoading } = useQuery(
    convexQuery(api.files.listMyFiles, {})
  )

  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const saveFile = useConvexMutation(api.files.saveFile)
  const deleteFile = useConvexMutation(api.files.deleteFile)

  const [isUploading, setIsUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const convex = useConvex()

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !session?.user) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    setUploadProgress('Getting upload URL...')

    try {
      const { uploadUrl, intentId } = await generateUploadUrl()

      setUploadProgress('Uploading file...')

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = await response.json()

      setUploadProgress('Saving metadata...')

      await saveFile({
        intentId,
        storageId,
        name: file.name,
      })

      setUploadProgress('')
      toast.success('File uploaded successfully!')
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Upload failed. Please try again.')
      setUploadProgress('')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownload = async (id: Id<'files'>) => {
    setDownloadingId(id)
    try {
      const url = await convex.query(api.files.getDownloadUrl, { id })
      if (!url) throw new Error('Download URL unavailable')
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Failed to download file.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await deleteFile({ id: id as Id<'files'> })
      toast.success('File deleted.')
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete file.')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={backTo}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <File className="w-5 h-5" />
              File Storage
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h2 className="font-semibold mb-4">Upload a File</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {session?.user
              ? 'Maximum file size: 10MB'
              : 'Sign in to try authenticated uploads. The example still renders safely without a session.'}
          </p>

          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              disabled={isUploading || !session?.user}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${
                isUploading || !session?.user ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>
                {isUploading
                  ? uploadProgress
                  : session?.user
                    ? 'Choose a file'
                    : 'Sign in required'}
              </span>
            </label>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Your Files</h2>
          </div>

          {isFilesLoading || isSessionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : files?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No files uploaded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {files?.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <File className="w-8 h-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • {formatRelativeTime(file._creationTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(file._id)}
                      disabled={downloadingId === file._id}
                      className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      {downloadingId === file._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(file._id)}
                      className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
