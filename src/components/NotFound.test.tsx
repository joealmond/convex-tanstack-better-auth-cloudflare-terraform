import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import { NotFound } from './NotFound'

describe('NotFound Component', () => {
  it('renders the actual page and a home link', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Page Not Found' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Go Home' }).getAttribute('href')).toBe('/')
  })

  it('navigates back when requested', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    render(<NotFound />)

    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }))
    expect(back).toHaveBeenCalledOnce()
    back.mockRestore()
  })
})
