import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { Bot, Loader2, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@convex/_generated/api'
import { useSession } from '@/lib/use-auth-session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AiStreamingExample() {
  const { data: session, isPending } = useSession()
  const { data: runs } = useQuery({
    ...convexQuery(api.ai.listRecent, {}),
    enabled: Boolean(session?.user),
  })
  const start = useConvexMutation(api.ai.start)
  const [prompt, setPrompt] = useState(
    'Explain why realtime databases simplify collaborative apps.'
  )
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!prompt.trim()) return
    setSubmitting(true)
    try {
      await start({ prompt })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start generation')
    } finally {
      setSubmitting(false)
    }
  }

  if (isPending) return <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin" />

  if (!session?.user) {
    return (
      <Card className="mx-auto mt-16 max-w-xl">
        <CardHeader>
          <CardTitle>Sign in to stream AI output</CardTitle>
          <CardDescription>
            Authentication and a conservative rate limit protect API spend.
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
            <Sparkles className="h-4 w-4" /> OpenAI Responses API
          </p>
          <h1 className="text-3xl font-bold">Realtime AI Streaming</h1>
          <p className="mt-2 text-muted-foreground">
            A Convex action consumes provider SSE, batches deltas, and persists them for realtime
            subscriptions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/examples">All examples</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask the model</CardTitle>
          <CardDescription>
            Set OPENAI_API_KEY and optionally OPENAI_MODEL on the Convex deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={1_000}
              rows={4}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="AI prompt"
            />
            <Button type="submit" disabled={submitting || !prompt.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Generate
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4" aria-live="polite">
        {runs?.map((run) => (
          <Card key={run._id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4" /> {run.prompt}
                </CardTitle>
                <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                  {run.status}
                </span>
              </div>
              {run.model && <CardDescription>{run.model}</CardDescription>}
            </CardHeader>
            <CardContent>
              {run.error ? (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {run.error}
                </p>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">
                  {run.output || (run.status === 'queued' ? 'Waiting for the action…' : '')}
                  {run.status === 'streaming' && (
                    <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary" />
                  )}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
