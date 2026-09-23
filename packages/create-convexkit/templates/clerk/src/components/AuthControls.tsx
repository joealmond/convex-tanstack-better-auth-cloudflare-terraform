import { SignInButton, UserButton, useUser } from '@clerk/tanstack-react-start'
import { Loader2 } from 'lucide-react'

export function AuthControls() {
  const { user, isLoaded } = useUser()
  if (!isLoaded) return <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading account" />
  if (user) return <UserButton />
  return (
    <SignInButton mode="modal">
      <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
        Sign in
      </button>
    </SignInButton>
  )
}
