import { createFileRoute, Link } from '@tanstack/react-router'
import { ExampleForm } from '@/components/ExampleForm'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/examples/forms')({
  component: FormsExample,
})

function FormsExample() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">ConvexKit example</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              Forms
            </h1>
          </div>
          <Link
            to="/examples"
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-xl px-4 py-8">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">React Hook Form + Zod</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This form validates on submit, shows field-level errors, and keeps the schema close to
              the UI that uses it.
            </p>
          </div>
          <ExampleForm
            onSubmit={async () => {
              await new Promise((resolve) => setTimeout(resolve, 500))
              toast.success('Form submitted.')
            }}
          />
        </div>
      </main>
    </div>
  )
}
