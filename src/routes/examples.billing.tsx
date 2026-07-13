import { createFileRoute } from '@tanstack/react-router'
import { BillingExample } from '@/components/examples/BillingExample'

export const Route = createFileRoute('/examples/billing')({ component: BillingExample })
