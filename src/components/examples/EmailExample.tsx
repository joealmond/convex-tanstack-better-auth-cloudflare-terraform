import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@convex/_generated/api'
import { useSession } from '@/lib/use-auth-session'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function EmailExample() {
  const { data: session, isPending } = useSession()
  const { data: deliveries } = useQuery({
    ...convexQuery(api.emails.listMine, {}),
    enabled: Boolean(session?.user),
  })
  const requestTest = useConvexMutation(api.emails.requestTest)

  if (isPending) return <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin" />
  if (!session?.user) {
    return (
      <Card className="mx-auto mt-16 max-w-xl">
        <CardHeader>
          <CardTitle>Sign in to test email</CardTitle>
          <CardDescription>
            A welcome email is automatically queued after account creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Open sign-in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Mail className="h-4 w-4" /> Resend + Convex
          </p>
          <h1 className="text-3xl font-bold">Transactional Email</h1>
          <p className="mt-2 text-muted-foreground">
            Signup hook, queued background delivery, status tracking, and per-user rate limits.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/examples">All examples</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send a test message</CardTitle>
          <CardDescription>
            Delivery goes to {session.user.email}. Configure RESEND_API_KEY and RESEND_FROM_EMAIL on
            Convex.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              void requestTest({}).catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : 'Unable to queue email')
              )
            }
          >
            <Send className="h-4 w-4" /> Queue test email
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveries?.length ? (
            deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium capitalize">{delivery.kind} email</p>
                  <p className="text-sm text-muted-foreground">
                    {delivery.to} · {formatRelativeTime(delivery._creationTime)}
                  </p>
                  {delivery.error && (
                    <p className="mt-1 text-sm text-destructive">{delivery.error}</p>
                  )}
                </div>
                <span className="self-start rounded-full border border-border px-2.5 py-1 text-xs capitalize text-muted-foreground sm:self-auto">
                  {delivery.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
