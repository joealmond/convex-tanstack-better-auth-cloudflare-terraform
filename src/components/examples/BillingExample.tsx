import { Link } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@convex/_generated/api'
import { useSession } from '@/lib/use-auth-session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function BillingExample() {
  const { data: session, isPending } = useSession()
  const { data: billing } = useQuery({
    ...convexQuery(api.billing.current, {}),
    enabled: Boolean(session?.user),
  })
  const createCheckout = useAction(api.stripe.createCheckout)
  const createPortal = useAction(api.stripe.createPortal)

  const redirect = async (kind: 'checkout' | 'portal') => {
    try {
      const result = kind === 'checkout' ? await createCheckout({}) : await createPortal({})
      window.location.assign(result.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to open ${kind}`)
    }
  }

  if (isPending) return <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin" />
  if (!session?.user) {
    return (
      <Card className="mx-auto mt-16 max-w-xl">
        <CardHeader>
          <CardTitle>Sign in to test billing</CardTitle>
          <CardDescription>Checkout metadata is tied to the authenticated account.</CardDescription>
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
            <CreditCard className="h-4 w-4" /> Stripe Checkout
          </p>
          <h1 className="text-3xl font-bold">Subscription Billing</h1>
          <p className="mt-2 text-muted-foreground">
            Hosted Checkout, verified raw-body webhooks, idempotency, and the customer portal.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/examples">All examples</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Starter plan</CardTitle>
            <CardDescription>Uses STRIPE_PRICE_ID configured securely on Convex.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void redirect('checkout')}>
              <ExternalLink className="h-4 w-4" /> Open Checkout
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription state</CardTitle>
            <CardDescription>
              Synced by Stripe webhook events, not client redirects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Status:</span>{' '}
              <strong>{billing?.status || 'No subscription'}</strong>
            </p>
            {billing?.priceId && (
              <p className="text-sm">
                <span className="text-muted-foreground">Price:</span> {billing.priceId}
              </p>
            )}
            {billing?.stripeCustomerId && (
              <Button variant="secondary" onClick={() => void redirect('portal')}>
                Manage billing
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Webhook endpoint</CardTitle>
          <CardDescription>
            Register this URL in Stripe Workbench and subscribe to Checkout and subscription
            lifecycle events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="rounded bg-muted px-2 py-1 text-sm">
            https://your-deployment.convex.site/api/stripe/webhook
          </code>
        </CardContent>
      </Card>
    </div>
  )
}
