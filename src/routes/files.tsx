import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSession, signIn } from '@/lib/auth-client'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import { 
  Upload, 
  File, 
  Trash2, 
  ArrowLeft, 
  Loader2,
  LogIn,
  Download
} from 'lucide-react'
import { useState, useRef } from 'react'

export const Route = createFileRoute('/files')({
  component: FilesPage,
})

function FilesPage() {
  const { data: session, isPending: isSessionLoading } = useSession()
  const { data: files, isLoading: isFilesLoading } = useQuery(
    convexQuery(api.files.listMyFiles, {})
  )

  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const saveFile = useConvexMutation(api.files.saveFile)
  const deleteFile = useConvexMutation(api.files.deleteFile)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress('Getting upload URL...')

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl()

      setUploadProgress('Uploading file...')

      // Upload file to Convex storage
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

      // Save file metadata
      await saveFile({
        storageId,
        name: file.name,
        type: file.type,
        size: file.size,
      })

      setUploadProgress('')
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadProgress('Upload failed!')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await deleteFile({ id: id as any })
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleSignIn = () => {
    signIn.social({ provider: 'google' })
  }

  // Not authenticated
  if (!isSessionLoading && !session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <File className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">File Storage Demo</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to upload and manage your files using Convex storage.
          </p>
          <button
            onClick={handleSignIn}
            className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-4 justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Upload Section */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h2 className="font-semibold mb-4">Upload a File</h2>
          
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>{isUploading ? uploadProgress : 'Choose a file'}</span>
            </label>
          </div>
        </div>

        {/* Files List */}
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
                      {formatFileSize(file.size)} • {formatRelativeTime(file.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-md hover:bg-muted transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
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
