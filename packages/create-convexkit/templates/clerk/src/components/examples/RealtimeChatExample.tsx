import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { SignInButton, UserButton, useUser } from '@clerk/tanstack-react-start'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Id } from '@convex/_generated/dataModel'
import { api } from '@convex/_generated/api'

export function RealtimeChatExample() {
  const { user, isLoaded } = useUser()
  const { data: messages = [] } = useQuery(convexQuery(api.messages.list, {}))
  const sendMessage = useConvexMutation(api.messages.send)
  const removeMessage = useConvexMutation(api.messages.remove)
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!content.trim()) return
    setIsSending(true)
    try {
      await sendMessage({
        content: content.trim(),
        anonymousId: user ? undefined : getAnonymousSessionId(),
      })
      setContent('')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Realtime Chat</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/examples" className="text-sm text-muted-foreground">
              Examples
            </Link>
            {isLoaded &&
              (user ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                    Sign in
                  </button>
                </SignInButton>
              ))}
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="max-h-[520px] space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <article
                key={message._id}
                className="flex items-start gap-3 rounded-md bg-muted/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{message.authorName ?? 'Anonymous'}</p>
                  <p className="mt-1 break-words">{message.content}</p>
                </div>
                {user?.id === message.authorId && (
                  <button
                    aria-label="Delete message"
                    onClick={() => void removeMessage({ id: message._id as Id<'messages'> })}
                    className="p-1 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </article>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border p-4">
            <label className="sr-only" htmlFor="message">
              Message
            </label>
            <input
              id="message"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2"
              placeholder="Type a message…"
            />
            <button
              disabled={isSending || !content.trim()}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function getAnonymousSessionId() {
  const key = 'convexkit-anonymous-id'
  let value = localStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID()
    localStorage.setItem(key, value)
  }
  return value
}
