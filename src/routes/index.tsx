import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSession, signIn, signOut } from '@/lib/auth-client'
import { useAdmin } from '@/hooks/use-admin'
import { formatRelativeTime } from '@/lib/utils'
import { MessageSquare, Send, LogIn, LogOut, User, Loader2, Trash2, Shield } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '@convex/_generated/dataModel'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { data: session, isPending: isSessionLoading } = useSession()
  const { data: messages, isLoading: isMessagesLoading } = useQuery(
    convexQuery(api.messages.list, {})
  )

  const [newMessage, setNewMessage] = useState('')
  const sendMessage = useConvexMutation(api.messages.send)
  const deleteMessage = useConvexMutation(api.messages.remove)
  const deleteAnyMessage = useConvexMutation(api.messages.deleteAny)
  const [isSending, setIsSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Admin status
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
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
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Hello Convex + Cloudflare</h1>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              to="/files"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Files
            </Link>

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
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in with Google
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-lg border border-border shadow-sm">
          {/* Messages List */}
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {isMessagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages?.length === 0 ? (
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
                          {formatRelativeTime(message.createdAt)}
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

          {/* Message Input */}
          <form onSubmit={handleSend} className="border-t border-border p-4 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={session?.user ? 'Type a message...' : 'Sign in to send messages'}
              disabled={!session?.user || isSending}
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!session?.user || !newMessage.trim() || isSending}
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

        {/* Info Box */}
        <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
          <h2 className="font-semibold mb-2">✨ What's working here:</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✅ Real-time messages from Convex database</li>
            <li>✅ Better Auth with Google OAuth</li>
            <li>✅ Role-based access control (RBAC) with admin features</li>
            <li>✅ SSR via TanStack Start</li>
            <li>✅ Deployed on Cloudflare Workers</li>
            <li>✅ Tailwind CSS styling</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            💡 <strong>Become Admin:</strong> Add your email to{' '}
            <code className="text-primary">ADMIN_EMAILS</code> in{' '}
            <code className="text-primary">convex/lib/config.ts</code> — see{' '}
            <code className="text-primary">docs/RBAC.md</code> for details.
          </p>
        </div>
      </main>

      {/* Footer */}
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
