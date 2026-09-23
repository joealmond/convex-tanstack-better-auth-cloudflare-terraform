import { useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/teams')({ component: TeamsPage })

function TeamsPage() {
  const memberships = useQuery(api.organizations.mine)
  const invitations = useQuery(api.organizations.myInvitations)
  const create = useMutation(api.organizations.create)
  const accept = useMutation(api.organizations.acceptInvitation)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [notice, setNotice] = useState('')

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await create({ name: name.trim(), slug: slug.trim().toLowerCase() })
      setName('')
      setSlug('')
      setNotice('Team created.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to create team.')
    }
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm underline">
        Home
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Teams</h1>
      {notice && (
        <p role="status" className="mt-4">
          {notice}
        </p>
      )}

      <form onSubmit={createTeam} className="mt-8 flex flex-wrap gap-3">
        <label>
          Team name{' '}
          <input
            className="rounded border px-2 py-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label>
          Slug{' '}
          <input
            className="rounded border px-2 py-1"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            pattern="[a-z0-9-]{3,64}"
          />
        </label>
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" type="submit">
          Create team
        </button>
      </form>

      <h2 className="mt-10 text-xl font-semibold">Your teams</h2>
      {memberships?.length ? (
        <ul className="mt-3 space-y-4">
          {memberships.map(
            (membership) =>
              membership.organization && (
                <li key={membership._id} className="rounded border p-4">
                  <strong>{membership.organization.name}</strong> <span>({membership.role})</span>
                  {membership.role !== 'member' && (
                    <InviteForm organizationId={membership.organizationId} />
                  )}
                </li>
              )
          )}
        </ul>
      ) : (
        <p className="mt-3">No teams yet.</p>
      )}

      <h2 className="mt-10 text-xl font-semibold">Invitations</h2>
      {invitations?.length ? (
        <ul className="mt-3 space-y-3">
          {invitations.map((invitation) => (
            <li
              key={invitation._id}
              className="flex items-center justify-between rounded border p-4"
            >
              <span>
                {invitation.organization?.name ?? 'Team'} — {invitation.role}
              </span>
              <button
                type="button"
                className="rounded border px-3 py-1"
                onClick={async () => {
                  try {
                    await accept({ organizationId: invitation.organizationId })
                    setNotice('Invitation accepted.')
                  } catch (error) {
                    setNotice(
                      error instanceof Error ? error.message : 'Unable to accept invitation.'
                    )
                  }
                }}
              >
                Accept
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3">
          No pending invitations. Invitations appear here after you verify your email.
        </p>
      )}
    </main>
  )
}

function InviteForm({ organizationId }: { organizationId: Id<'organizations'> }) {
  const invite = useMutation(api.organizations.invite)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await invite({ organizationId, email: email.trim(), role: 'member' })
      setEmail('')
      setNotice(
        'Invitation created. It will appear in the invited user’s account after email verification.'
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to invite member.')
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <label>
        Invite by email{' '}
        <input
          className="rounded border px-2 py-1"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <button type="submit" className="rounded border px-3 py-1">
        Invite
      </button>
      {notice && <span role="status">{notice}</span>}
    </form>
  )
}
