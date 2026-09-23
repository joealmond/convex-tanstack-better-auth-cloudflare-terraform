import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TodosExample } from './TodosExample'

const { mutation, loadMore, todos } = vi.hoisted(() => ({
  mutation: vi.fn().mockResolvedValue(undefined),
  loadMore: vi.fn(),
  todos: [
    {
      _id: 'todo_b',
      _creationTime: 1,
      title: 'Bravo',
      completed: false,
      updatedAt: 1,
      ownerId: 'user',
    },
    {
      _id: 'todo_a',
      _creationTime: 2,
      title: 'Alpha',
      completed: false,
      updatedAt: 2,
      ownerId: 'user',
    },
  ],
}))
vi.mock('convex/react', () => ({
  useMutation: () => Object.assign(mutation, { withOptimisticUpdate: () => mutation }),
  usePaginatedQuery: () => ({ results: todos, isLoading: false, status: 'CanLoadMore', loadMore }),
  optimisticallyUpdateValueInPaginatedQuery: vi.fn(),
}))
vi.mock('@/lib/use-auth-session', () => ({
  useSession: () => ({ data: { user: { id: 'user' } }, isPending: false }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
afterEach(cleanup)

it('sorts fetched todos, keeps actions on the correct row, and requests another page', () => {
  render(<TodosExample />)
  const rows = () => screen.getAllByRole('row').slice(1)
  expect(within(rows()[0]!).getByText('Bravo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Todo' }))
  expect(within(rows()[0]!).getByText('Alpha')).toBeTruthy()
  fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Mark complete' }))
  expect(mutation).toHaveBeenCalledWith({ id: 'todo_a', completed: true })
  fireEvent.click(screen.getByRole('button', { name: 'Todo' }))
  expect(within(rows()[0]!).getByText('Bravo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(loadMore).toHaveBeenCalledWith(10)
})
