import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  optimisticallyUpdateValueInPaginatedQuery,
  useMutation,
  usePaginatedQuery,
} from 'convex/react'
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@convex/_generated/api'
import type { Doc, Id } from '@convex/_generated/dataModel'
import { useSession } from '@/lib/use-auth-session'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PAGE_SIZE = 10

export function TodosExample() {
  const { data: session, isPending: sessionPending } = useSession()
  const pagination = usePaginatedQuery(api.todos.list, session?.user ? {} : 'skip', {
    initialNumItems: PAGE_SIZE,
  })
  const createTodo = useMutation(api.todos.create)
  const removeTodo = useMutation(api.todos.remove)
  const renameTodo = useMutation(api.todos.rename)
  const setCompleted = useMutation(api.todos.setCompleted).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateValueInPaginatedQuery(localStore, api.todos.list, {}, (todo) =>
        todo._id === args.id ? { ...todo, completed: args.completed } : todo
      )
    }
  )

  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [editing, setEditing] = useState<Doc<'todos'> | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const columns = useMemo<ColumnDef<Doc<'todos'>>[]>(
    () => [
      {
        id: 'completed',
        header: 'Done',
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={row.original.completed ? 'Mark incomplete' : 'Mark complete'}
            className="flex h-6 w-6 items-center justify-center rounded border border-input transition-colors hover:border-primary"
            onClick={() =>
              void setCompleted({ id: row.original._id, completed: !row.original.completed })
            }
          >
            {row.original.completed && <Check className="h-4 w-4 text-primary" />}
          </button>
        ),
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Todo <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <span className={row.original.completed ? 'text-muted-foreground line-through' : ''}>
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatRelativeTime(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Rename ${row.original.title}`}
              onClick={() => {
                setEditing(row.original)
                setEditTitle(row.original.title)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${row.original.title}`}
              onClick={() =>
                void removeTodo({ id: row.original._id }).catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : 'Unable to delete todo')
                )
              }
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [removeTodo, setCompleted]
  )

  const table = useReactTable({
    data: pagination.results,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const submitTodo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      await createTodo({ title })
      setTitle('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add todo')
    } finally {
      setCreating(false)
    }
  }

  const saveRename = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || !editTitle.trim()) return
    try {
      await renameTodo({ id: editing._id as Id<'todos'>, title: editTitle })
      setEditing(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to rename todo')
    }
  }

  if (sessionPending) {
    return <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin text-muted-foreground" />
  }

  if (!session?.user) {
    return (
      <Card className="mx-auto mt-16 max-w-xl">
        <CardHeader>
          <CardTitle>Sign in to use Todos</CardTitle>
          <CardDescription>
            Todos are private per account. Email/password works without configuring OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Open sign-in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Convex + TanStack Table</p>
          <h1 className="text-3xl font-bold">Realtime Todos</h1>
          <p className="mt-2 text-muted-foreground">
            Optimistic completion, cursor pagination, sorting, ownership checks, and rate limits.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/examples">All examples</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your list</CardTitle>
          <CardDescription>Changes sync to every open client in real time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-6 flex gap-2" onSubmit={submitTodo}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="What needs to be done?"
              aria-label="New todo"
            />
            <Button type="submit" disabled={creating || !title.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </Button>
          </form>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 font-medium">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {!pagination.isLoading && pagination.results.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No todos yet. Add the first one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              disabled={pagination.status !== 'CanLoadMore'}
              onClick={() => pagination.loadMore(PAGE_SIZE)}
            >
              {pagination.status === 'LoadingMore' && <Loader2 className="h-4 w-4 animate-spin" />}
              {pagination.status === 'Exhausted' ? 'All todos loaded' : 'Load more'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <form onSubmit={saveRename}>
            <DialogHeader>
              <DialogTitle>Rename todo</DialogTitle>
              <DialogDescription>Keep the title concise and actionable.</DialogDescription>
            </DialogHeader>
            <Input
              className="my-5"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              maxLength={160}
              autoFocus
            />
            <DialogFooter>
              <Button type="submit" disabled={!editTitle.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
