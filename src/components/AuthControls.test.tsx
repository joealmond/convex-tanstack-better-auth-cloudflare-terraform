import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthControls } from './AuthControls'

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signUpEmail: vi.fn(),
  magicLink: vi.fn(),
  social: vi.fn(),
  providers: {
    isGoogleAuthEnabled: false,
    isAppleAuthEnabled: false,
    isMagicLinkAuthEnabled: false,
  },
}))

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signIn: { email: vi.fn(), social: mocks.social, magicLink: mocks.magicLink },
  signUp: { email: mocks.signUpEmail },
  signOut: vi.fn(),
  authClient: {
    requestPasswordReset: mocks.requestPasswordReset,
    sendVerificationEmail: mocks.sendVerificationEmail,
  },
}))
vi.mock('@/lib/env', () => mocks.providers)
afterEach(() => {
  cleanup()
  mocks.providers.isAppleAuthEnabled = false
  mocks.providers.isMagicLinkAuthEnabled = false
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

it('sends a passwordless link for new or returning readers', async () => {
  mocks.providers.isMagicLinkAuthEnabled = true
  mocks.magicLink.mockResolvedValue({ error: null })
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.queryByLabelText('Password')).toBeNull()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
  await waitFor(() =>
    expect(mocks.magicLink).toHaveBeenCalledWith({
      email: 'reader@example.com',
      callbackURL: '/',
      errorCallbackURL: '/?authError=1',
    })
  )
  expect(screen.getByRole('status').textContent).toContain('5 minutes')
})

it('shows email delivery errors', async () => {
  mocks.providers.isMagicLinkAuthEnabled = true
  mocks.magicLink.mockResolvedValue({ error: { message: 'Email delivery unavailable' } })
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
  await screen.findByText('Email delivery unavailable')
  expect(screen.queryByRole('status')).toBeNull()
})

it('starts Apple sign-in and displays provider errors', async () => {
  mocks.providers.isAppleAuthEnabled = true
  mocks.social.mockResolvedValue({ error: { message: 'Apple unavailable' } })
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }))
  await waitFor(() =>
    expect(mocks.social).toHaveBeenCalledWith({ provider: 'apple', callbackURL: '/' })
  )
  await screen.findByText('Apple unavailable')
})
