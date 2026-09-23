import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client'
import { isGoogleAuthEnabled } from '@/lib/env'

export function AuthControls() {
  const { data: session, isPending } = useSession()
  if (isPending) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading account" />
  if (session?.user)
    return (
      <div className="flex items-center gap-3">
        <span>{session.user.name}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md bg-secondary px-3 py-2"
        >
          Sign Out
        </button>
      </div>
    )
  return (
    <EmailAuthControls
      onGoogleSignIn={() => {
        void signIn.social({ provider: 'google' })
      }}
    />
  )
}

export function EmailAuthControls({ onGoogleSignIn }: { onGoogleSignIn: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setErrorMessage(null)
    try {
      const result =
        mode === 'sign-up'
          ? await signUp.email({ name: name.trim(), email: email.trim(), password })
          : await signIn.email({ email: email.trim(), password })
      if (result.error) throw new Error(result.error.message ?? 'Authentication failed')
      location.reload()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        aria-expanded={open}
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-12 z-50 w-80 space-y-3 rounded-lg border border-border bg-card p-4 shadow-xl"
        >
          <div className="flex gap-2" role="group" aria-label="Authentication mode">
            {(['sign-in', 'sign-up'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded px-2 py-1 text-sm ${mode === value ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
              >
                {value === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          {mode === 'sign-up' && (
            <label className="block text-sm">
              Name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
              />
            </label>
          )}
          <label className="block text-sm">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              required
              minLength={12}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
            />
          </label>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
          {isGoogleAuthEnabled && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full rounded bg-secondary px-3 py-2 text-sm"
            >
              Continue with Google
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Your session is shared across all application features.
          </p>
        </form>
      )}
    </div>
  )
}
