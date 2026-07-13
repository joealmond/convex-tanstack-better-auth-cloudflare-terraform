import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Bot,
  ClipboardCheck,
  CreditCard,
  FileArchive,
  Mail,
  MessageSquare,
  Shield,
  SquareCheckBig,
  Table2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const Route = createFileRoute('/examples/')({
  component: ExamplesPage,
})

type ExampleHref =
  | '/examples/chat'
  | '/examples/files'
  | '/examples/admin'
  | '/examples/forms'
  | '/examples/todos'
  | '/examples/ai'
  | '/examples/email'
  | '/examples/billing'

type Example = {
  title: string
  description: string
  status: string
  href: ExampleHref
  icon: LucideIcon
}

const examples: Example[] = [
  {
    title: 'Realtime Chat',
    description:
      'Public realtime messages with anonymous posting, auth-aware names, and rate limits.',
    status: 'Available',
    href: '/examples/chat',
    icon: MessageSquare,
  },
  {
    title: 'File Uploads',
    description: 'Convex storage uploads with metadata, download URLs, and owner-only deletion.',
    status: 'Available with auth',
    href: '/examples/files',
    icon: FileArchive,
  },
  {
    title: 'Admin / RBAC',
    description: 'Admin-only controls, protected routes, and impersonation-ready app structure.',
    status: 'Available with auth',
    href: '/examples/admin',
    icon: Shield,
  },
  {
    title: 'Forms',
    description: 'React Hook Form and Zod validation with field-level errors and submit states.',
    status: 'Available',
    href: '/examples/forms',
    icon: ClipboardCheck,
  },
  {
    title: 'Todos',
    description: 'Optimistic updates, cursor pagination, and TanStack Table list view.',
    status: 'Available with auth',
    href: '/examples/todos',
    icon: SquareCheckBig,
  },
  {
    title: 'Data Table',
    description: 'Reusable table patterns for sorting, filtering, and paginated Convex queries.',
    status: 'Included in Todos',
    href: '/examples/todos',
    icon: Table2,
  },
  {
    title: 'AI Streaming',
    description: 'Convex action that streams an LLM response into the UI.',
    status: 'Available with API key',
    href: '/examples/ai',
    icon: Bot,
  },
  {
    title: 'Stripe Billing',
    description: 'Checkout, subscription state, and webhook handling.',
    status: 'Available with Stripe',
    href: '/examples/billing',
    icon: CreditCard,
  },
  {
    title: 'Transactional Email',
    description: 'Resend welcome email hook, queued delivery, and status tracking.',
    status: 'Available with API key',
    href: '/examples/email',
    icon: Mail,
  },
]

function ExamplesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">ConvexKit examples</p>
            <h1 className="text-2xl font-bold">Feature Examples</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Back home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((example) => {
            const Icon = example.icon
            return (
              <Link
                key={example.title}
                to={example.href}
                className="flex min-h-48 flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/60 hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {example.status}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{example.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {example.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
