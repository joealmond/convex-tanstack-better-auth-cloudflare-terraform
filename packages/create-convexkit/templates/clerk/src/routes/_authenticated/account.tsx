import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/tanstack-react-start'
import { useAction, useConvex } from 'convex/react'
import { api } from '@convex/_generated/api'
import { exportKinds } from '@/lib/export-kinds'
import { downloadAccountData } from '@/lib/account-export'

export const Route = createFileRoute('/_authenticated/account')({ component: AccountPage })

function AccountPage() {
  const { user } = useUser()
  const convex = useConvex()
  const prepareAccountDeletion = useAction(api.users.prepareAccountDeletion)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  async function exportData() {
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

  async function deleteAccount() {
    if (!user || !window.confirm('Permanently delete your Clerk account and application data?'))
      return
    setPending(true)
    try {
      await prepareAccountDeletion({})
      await user.delete()
      location.href = '/'
    } catch (error) {
      setNotice(
        `Application data cleanup was requested. Clerk account deletion failed: ${error instanceof Error ? error.message : 'contact support to finish deletion.'}`
      )
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
      <p className="mt-4">{user?.primaryEmailAddress?.emailAddress}</p>
      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Download your data</h2>
        <button
          type="button"
          disabled={pending || !user}
          onClick={() => void exportData()}
          className="mt-4 rounded border px-4 py-2"
        >
          Download data
        </button>
      </div>
      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Delete account</h2>
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
          disabled={pending || !user}
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
