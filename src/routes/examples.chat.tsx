import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { RealtimeChatExample } from '@/components/examples/RealtimeChatExample'

export const Route = createFileRoute('/examples/chat')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.messages.list, {}))
  },
  component: RealtimeChatExample,
})
