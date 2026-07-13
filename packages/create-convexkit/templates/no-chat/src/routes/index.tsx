import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-primary">ConvexKit</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
        Your realtime app starts here.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        TanStack Start, Convex, production authentication, and deployment configuration—composed for
        this project.
      </p>
      <div className="mt-8">
        <Link
          to="/examples"
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground"
        >
          Explore examples
        </Link>
      </div>
    </main>
  )
}
