import { createFileRoute } from '@tanstack/react-router'
import { AdminRbacExample } from '@/components/examples/AdminRbacExample'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: AdminRbacExample,
})
