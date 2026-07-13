import { createFileRoute } from '@tanstack/react-router'
import { TodosExample } from '@/components/examples/TodosExample'

export const Route = createFileRoute('/examples/todos')({
  component: TodosExample,
})
