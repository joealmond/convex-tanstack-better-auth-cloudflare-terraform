import { SignInButton, UserButton, useUser } from '@clerk/tanstack-react-start'
import { Loader2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function AuthControls() {
  const { user, isLoaded } = useUser()
  if (!isLoaded) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading account" />
  if (user)
    return (
      <div className="flex items-center gap-3">
        <Link to="/account" className="underline">
          Account
        </Link>
        <UserButton />
      </div>
    )
  return (
    <SignInButton mode="modal">
      <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
        Sign in
      </button>
    </SignInButton>
  )
}
