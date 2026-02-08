import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    // Check authentication from root route context
    // The root route's beforeLoad already called getToken() and set isAuthenticated
    if (!context.isAuthenticated) {
      // Redirect to home page (which shows the sign-in button)
      throw redirect({ to: '/' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
