import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthControls } from './AuthControls'

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signUpEmail: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: mocks.signUpEmail },
  signOut: vi.fn(),
  authClient: {
    requestPasswordReset: mocks.requestPasswordReset,
    sendVerificationEmail: mocks.sendVerificationEmail,
  },
}))
vi.mock('@/lib/env', () => ({ isGoogleAuthEnabled: false }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('offers email signup without depending on chat or a messages query', () => {
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Create account' }).at(-1)!)
  expect(screen.getByLabelText('Name')).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
  expect(screen.getByLabelText('Password').getAttribute('minlength')).toBe('12')
  expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
})

it('offers a generic password recovery request', async () => {
  mocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null })
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  await waitFor(() => expect(mocks.requestPasswordReset).toHaveBeenCalledOnce())
  expect(mocks.requestPasswordReset.mock.calls[0]?.[0]).toMatchObject({
    email: 'person@example.com',
    redirectTo: expect.stringMatching(/\/reset-password$/),
  })
  expect(screen.getByRole('status').textContent).toContain('If that account exists')
})

it('shows verification instructions after signup without a session', async () => {
  mocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null })
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Person' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'long-enough-password' },
  })
  fireEvent.click(screen.getAllByRole('button', { name: 'Create account' }).at(-1)!)
  await waitFor(() => expect(mocks.signUpEmail).toHaveBeenCalledOnce())
  expect(screen.getByRole('status').textContent).toContain('verification link')
  expect(screen.getByRole('button', { name: 'Resend verification' })).toBeTruthy()
})
