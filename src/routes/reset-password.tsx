import { useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search) => ({
    token: typeof search.token === 'string' ? search.token : '',
    error: typeof search.error === 'string' ? search.error : '',
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      const result = await authClient.resetPassword({ newPassword: password, token })
      if (result.error) throw new Error(result.error.message ?? 'Password reset failed')
      setNotice('Password updated. You can sign in now.')
      setPassword('')
      window.history.replaceState(null, '', '/reset-password')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Password reset failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">Reset password</h1>
      {!token || error ? (
        <p className="mt-4" role="alert">
          This reset link is invalid or expired. Request a new link from the sign-in form.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            New password
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="mt-4">
          {notice}
        </p>
      )}
      <Link to="/" className="mt-6 inline-block underline">
        Back to home
      </Link>
    </main>
  )
}
