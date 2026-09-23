import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { api } from '@convex/_generated/api'
import { authClient, useSession } from '@/lib/auth-client'
import { exportKinds } from '@/lib/export-kinds'
import { downloadAccountData } from '@/lib/account-export'

export const Route = createFileRoute('/_authenticated/account')({ component: AccountPage })

function AccountPage() {
  const { data: session } = useSession()
  const convex = useConvex()
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  async function downloadData() {
    setPending(true)
    setNotice('Preparing your data export…')
    try {
      await downloadAccountData(exportKinds, (kind, cursor) =>
        convex.query(api.userExport.page, { kind, cursor })
      )
      setNotice('Your data export is ready.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Data export failed')
    } finally {
      setPending(false)
    }
  }

  async function resendVerification() {
    if (!session?.user.email) return
    setPending(true)
    try {
      const result = await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: '/account',
      })
      if (result.error) throw new Error(result.error.message ?? 'Verification unavailable')
      setNotice('Check your email for a verification link.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Verification unavailable')
    } finally {
      setPending(false)
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Permanently delete your account and its application data?')) return
    setPending(true)
    try {
      const result = await authClient.deleteUser({ callbackURL: '/' })
      if (result.error) throw new Error(result.error.message ?? 'Account deletion failed')
      if (result.data?.message === 'Verification email sent') {
        setNotice('Check your email to confirm account deletion.')
      } else {
        location.href = '/'
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Account deletion failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="underline">
        Home
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Account</h1>
      <p className="mt-4">{session?.user.email}</p>
      {session?.user && !session.user.emailVerified && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void resendVerification()}
          className="mt-6 rounded border px-4 py-2"
        >
          Resend verification email
        </button>
      )}
      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Download your data</h2>
        <p className="mt-2">
          Download a JSON copy of your account data. Selected file uploads include their content.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void downloadData()}
          className="mt-4 rounded border px-4 py-2"
        >
          Download data
        </button>
      </div>
      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Delete account</h2>
        <p className="mt-2">This permanently removes your account and its application data.</p>
        {/* <convexkit:billing> */}
        <p className="mt-2">
          Cancel an active subscription in the billing portal before deleting your account.
        </p>
        <Link to="/examples/billing" className="mt-2 inline-block underline">
          Manage billing
        </Link>
        {/* </convexkit:billing> */}
        <button
          type="button"
          disabled={pending}
          onClick={() => void deleteAccount()}
          className="mt-4 rounded border border-destructive px-4 py-2 text-destructive"
        >
          Delete account
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-4">
          {notice}
        </p>
      )}
    </main>
  )
}
