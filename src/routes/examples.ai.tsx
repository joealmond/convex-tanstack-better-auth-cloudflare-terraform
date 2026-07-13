import { createFileRoute } from '@tanstack/react-router'
import { AiStreamingExample } from '@/components/examples/AiStreamingExample'

export const Route = createFileRoute('/examples/ai')({
  component: AiStreamingExample,
})
