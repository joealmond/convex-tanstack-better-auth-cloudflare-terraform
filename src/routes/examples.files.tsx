import { createFileRoute } from '@tanstack/react-router'
import { FileUploadsExample } from '@/components/examples/FileUploadsExample'

export const Route = createFileRoute('/examples/files')({
  component: FileUploadsRoute,
})

function FileUploadsRoute() {
  return <FileUploadsExample backTo="/examples" />
}
