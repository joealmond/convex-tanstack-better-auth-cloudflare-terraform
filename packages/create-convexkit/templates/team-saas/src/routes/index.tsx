import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthControls } from '@/components/AuthControls'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <h1 className="text-4xl font-bold">Your team app starts here.</h1>
      <p className="mt-4 text-lg">Sign in to create a team, invite members, and manage access.</p>
      <div className="mt-8 flex items-center gap-4">
        <AuthControls />
        <Link to="/teams" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Open teams
        </Link>
      </div>
    </main>
  )
}
