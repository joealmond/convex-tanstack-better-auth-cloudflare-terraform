import { useUser } from '@clerk/tanstack-react-start'

export function useSession() {
  const { isLoaded, user } = useUser()
  return {
    data: user
      ? {
          user: {
            id: user.id,
            name: user.fullName ?? user.username ?? 'User',
            email: user.primaryEmailAddress?.emailAddress ?? '',
            image: user.imageUrl,
          },
        }
      : null,
    isPending: !isLoaded,
  }
}
