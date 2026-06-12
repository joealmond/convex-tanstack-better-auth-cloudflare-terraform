import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSession, signIn, signOut } from '@/lib/auth-client'
import { isGoogleAuthEnabled } from '@/lib/env'
import { useAdmin } from '@/hooks/use-admin'
import { formatRelativeTime } from '@/lib/utils'
import { MessageSquare, Send, LogIn, LogOut, User, Loader2, Trash2, Shield } from 'lucide-react'
import { Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import type { Id } from '@convex/_generated/dataModel'

export function RealtimeChatExample() {
  return (
    <Suspense fallback={<RealtimeChatSkeleton />}>
      <RealtimeChatContent />
    </Suspense>
  )
}

function RealtimeChatContent() {
  const { data: session, isPending: isSessionLoading } = useSession()
  const { data: messages } = useSuspenseQuery(convexQuery(api.messages.list, {}))

  const [newMessage, setNewMessage] = useState('')
  const sendMessage = useConvexMutation(api.messages.send)
  const deleteMessage = useConvexMutation(api.messages.remove)
  const deleteAnyMessage = useConvexMutation(api.messages.deleteAny)
  const [isSending, setIsSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { isAdmin } = useAdmin()

  const handleDelete = async (messageId: Id<'messages'>, isOwner: boolean) => {
    setDeletingId(messageId)
    try {
      if (isOwner) {
        await deleteMessage({ id: messageId })
      } else if (isAdmin) {
        await deleteAnyMessage({ id: messageId })
      }
    } catch (error) {
      console.error('Failed to delete message:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    if (!newMessage.trim()) return

    setIsSending(true)
    try {
      await sendMessage({ content: newMessage.trim() })
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleSignIn = () => {
    signIn.social({ provider: 'google' })
  }

  const handleSignOut = () => {
    signOut()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Realtime Chat</h1>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              to="/examples"
              className="text-muted-foreground hover:text-foreground transition-colors"
              preload="intent"
            >
              Examples
            </Link>
            {isGoogleAuthEnabled && (
              <Link
                to="/files"
                className="text-muted-foreground hover:text-foreground transition-colors"
                preload="intent"
              >
                Files
              </Link>
            )}

            {isSessionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : session?.user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">{session.user.name}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-primary/20 text-primary border border-primary/50">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : isGoogleAuthEnabled ? (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in with Google
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">Anonymous demo</span>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-lg border border-border shadow-sm">
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {messages?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No messages yet. Be the first to say hello!</p>
              </div>
            ) : (
              messages?.map((message) => {
                const isOwner = session?.user && message.authorId === session.user.id
                const canDelete = isOwner || isAdmin

                return (
                  <div key={message._id} className="flex gap-3 p-3 rounded-lg bg-muted/50 group">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {message.authorName ?? 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(message._creationTime)}
                        </span>
                      </div>
                      <p className="text-foreground mt-1">{message.content}</p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(message._id, !!isOwner)}
                        disabled={deletingId === message._id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title={isOwner ? 'Delete your message' : 'Delete (Admin)'}
                      >
                        {deletingId === message._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-border p-4 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </form>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
          <h2 className="font-semibold mb-2">What's working here:</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Realtime Convex database + Better Auth-ready sessions</li>
            <li>Anonymous and authenticated messaging with rate limiting</li>
            <li>SSR with TanStack Start + React Query</li>
            <li>RBAC-aware deletion controls</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            Anonymous messages work out of the box. Enable Google OAuth in setup to show
            authenticated names. <strong>Become Admin:</strong> Add your email to{' '}
            <code className="text-primary">ADMIN_EMAILS</code> in{' '}
            <code className="text-primary">convex/lib/config.ts</code>.
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        <p>
          Built with{' '}
          <a href="https://tanstack.com/start" className="text-primary hover:underline">
            TanStack Start
          </a>
          {' + '}
          <a href="https://convex.dev" className="text-primary hover:underline">
            Convex
          </a>
          {' + '}
          <a href="https://workers.cloudflare.com" className="text-primary hover:underline">
            Cloudflare Workers
          </a>
        </p>
      </footer>
    </div>
  )
}

function RealtimeChatSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-muted animate-pulse" />
            <div className="h-6 w-48 rounded-md bg-muted animate-pulse" />
          </div>

          <div className="flex items-center gap-4">
            <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
            <div className="h-10 w-40 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-lg border border-border shadow-sm">
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded-md bg-muted animate-pulse" />
                  <div className="h-4 w-4/5 rounded-md bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-4 flex gap-2">
            <div className="flex-1 h-10 rounded-md bg-muted animate-pulse" />
            <div className="w-16 h-10 rounded-md bg-muted animate-pulse" />
          </div>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="h-5 w-48 rounded-md bg-muted animate-pulse" />
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center">
        <div className="h-4 w-56 rounded-md bg-muted animate-pulse mx-auto" />
      </footer>
    </div>
  )
}
