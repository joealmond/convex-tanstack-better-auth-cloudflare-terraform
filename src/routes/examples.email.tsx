import { createFileRoute } from '@tanstack/react-router'
import { EmailExample } from '@/components/examples/EmailExample'

export const Route = createFileRoute('/examples/email')({
  component: EmailExample,
})
