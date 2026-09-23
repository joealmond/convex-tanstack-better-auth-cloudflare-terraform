import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthControls } from './AuthControls'

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}))
vi.mock('@/lib/env', () => ({ isGoogleAuthEnabled: false }))
afterEach(cleanup)

it('offers email signup without depending on chat or a messages query', () => {
  render(<AuthControls />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByLabelText('Name')).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
  expect(screen.getByLabelText('Password').getAttribute('minlength')).toBe('12')
  expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
})
