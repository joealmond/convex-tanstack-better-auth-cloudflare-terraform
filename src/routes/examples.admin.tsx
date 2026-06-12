import { createFileRoute } from '@tanstack/react-router'
import { AdminRbacExample } from '@/components/examples/AdminRbacExample'

export const Route = createFileRoute('/examples/admin')({
  component: AdminExampleRoute,
})

function AdminExampleRoute() {
  return <AdminRbacExample backTo="/examples" />
}
