import { createFileRoute } from '@tanstack/react-router'
import { FileUploadsExample } from '@/components/examples/FileUploadsExample'

export const Route = createFileRoute('/_authenticated/files')({
  component: FileUploadsExample,
})
