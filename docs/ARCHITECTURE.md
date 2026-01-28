# Architecture Best Practices

This guide teaches you to build modular, maintainable applications using proven design patterns adapted for Convex + TanStack Start.

## Table of Contents

- [Project Structure](#project-structure)
- [Design Patterns](#design-patterns)
  - [Repository Pattern](#repository-pattern)
  - [Service Adapter Pattern](#service-adapter-pattern)
  - [Factory Pattern](#factory-pattern)
  - [Middleware/Decorator Pattern](#middlewaredecorator-pattern)
- [Modularity Principles](#modularity-principles)
- [Reusable Code Patterns](#reusable-code-patterns)
- [Frontend Architecture](#frontend-architecture)
- [Error Handling Strategies](#error-handling-strategies)

---

## Project Structure

### Recommended Layout

```
├── convex/
│   ├── lib/                    # Shared backend utilities
│   │   ├── authHelpers.ts      # Auth & RBAC helpers
│   │   ├── config.ts           # Environment & constants
│   │   ├── repositories/       # Data access layer
│   │   ├── services/           # Business logic & adapters
│   │   └── middleware/         # Reusable decorators
│   ├── schema.ts               # Database schema
│   ├── messages.ts             # Message domain functions
│   ├── users.ts                # User domain functions
│   └── [domain].ts             # Other domain modules
│
├── src/
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI components
│   │   └── features/           # Feature-specific components
│   ├── lib/                    # Client-side utilities
│   │   ├── hooks/              # Custom React hooks
│   │   ├── validation/         # Shared Zod schemas
│   │   └── utils.ts            # Helper functions
│   ├── routes/                 # TanStack Router pages
│   └── router.tsx              # Router configuration
```

### Key Principles

1. **Domain-Driven Structure**: Group by feature/domain, not by technical layer
2. **Shared Code**: Place reusable logic in `lib/` directories
3. **Separation of Concerns**: Keep business logic separate from presentation

---

## Design Patterns

### Repository Pattern

**Purpose**: Abstract data access logic to make it reusable, testable, and consistent.

**When to use**: When you have complex queries you'll reuse across multiple functions.

#### Example: User Repository

```typescript
// convex/lib/repositories/userRepository.ts
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

type Ctx = QueryCtx | MutationCtx

/**
 * User Repository - Centralized user data access
 */
export class UserRepository {
  constructor(private ctx: Ctx) {}

  /**
   * Find user by ID
   */
  async findById(id: Id<'users'>): Promise<User | null> {
    return await this.ctx.db.get(id)
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique()
  }

  /**
   * Get all admins
   */
  async getAdmins(): Promise<User[]> {
    return await this.ctx.db
      .query('users')
      .withIndex('by_role', (q) => q.eq('role', 'admin'))
      .collect()
  }

  /**
   * Get users with pagination
   */
  async paginate(limit: number, cursor?: string) {
    return await this.ctx.db
      .query('users')
      .order('desc')
      .paginate({ numItems: limit, cursor })
  }
}

// Usage in a Convex function
export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const repo = new UserRepository(ctx)
    return await repo.findByEmail(args.email)
  },
})
```

**Benefits**:
- ✅ Single source of truth for queries
- ✅ Easy to test (mock the repository)
- ✅ Consistent API across your app
- ✅ Reusable complex queries

---

### Service Adapter Pattern

**Purpose**: Wrap external services (email, payments, AI) to abstract implementation details.

**When to use**: When integrating third-party APIs or when you might swap services later.

#### Example: Email Service Adapter

```typescript
// convex/lib/services/emailService.ts
import { Resend } from '@convex-dev/resend'
import type { MutationCtx } from '../_generated/server'

/**
 * Email adapter interface - allows swapping implementations
 */
export interface IEmailService {
  sendWelcome(to: string, name: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
  sendNotification(to: string, subject: string, html: string): Promise<void>
}

/**
 * Resend implementation of email service
 */
export class ResendEmailService implements IEmailService {
  constructor(
    private ctx: MutationCtx,
    private resend: Resend
  ) {}

  async sendWelcome(to: string, name: string) {
    await this.resend.send(this.ctx, {
      from: 'noreply@yourapp.com',
      to,
      subject: `Welcome, ${name}!`,
      html: this.renderWelcomeTemplate(name),
    })
  }

  async sendPasswordReset(to: string, token: string) {
    const resetUrl = `https://yourapp.com/reset-password?token=${token}`
    await this.resend.send(this.ctx, {
      from: 'noreply@yourapp.com',
      to,
      subject: 'Reset your password',
      html: this.renderResetTemplate(resetUrl),
    })
  }

  async sendNotification(to: string, subject: string, html: string) {
    await this.resend.send(this.ctx, {
      from: 'notifications@yourapp.com',
      to,
      subject,
      html,
    })
  }

  private renderWelcomeTemplate(name: string): string {
    return `<h1>Welcome, ${name}!</h1><p>Thanks for joining.</p>`
  }

  private renderResetTemplate(resetUrl: string): string {
    return `<p>Click here to reset: <a href="${resetUrl}">Reset Password</a></p>`
  }
}

/**
 * Mock implementation for testing
 */
export class MockEmailService implements IEmailService {
  public sentEmails: Array<{ to: string; subject: string }> = []

  async sendWelcome(to: string, name: string) {
    this.sentEmails.push({ to, subject: `Welcome, ${name}!` })
  }

  async sendPasswordReset(to: string, token: string) {
    this.sentEmails.push({ to, subject: 'Reset your password' })
  }

  async sendNotification(to: string, subject: string) {
    this.sentEmails.push({ to, subject })
  }
}

// Usage in mutations
export const registerUser = mutation({
  handler: async (ctx, args) => {
    // ... create user ...
    
    const emailService = new ResendEmailService(ctx, resendComponent)
    await emailService.sendWelcome(args.email, args.name)
  },
})
```

**Benefits**:
- ✅ Easy to swap implementations (Resend → SendGrid)
- ✅ Testable (use mock in tests)
- ✅ Rate limiting in one place
- ✅ Consistent error handling

---

### Factory Pattern

**Purpose**: Create objects with consistent configuration and validation.

**When to use**: When you need to create similar objects with complex setup.

#### Example: Query Factory

```typescript
// convex/lib/factories/queryFactory.ts
import type { QueryCtx } from '../_generated/server'
import type { TableNames } from '../_generated/dataModel'

/**
 * Query builder factory for consistent filtering and sorting
 */
export class QueryFactory<T extends TableNames> {
  constructor(
    private ctx: QueryCtx,
    private table: T
  ) {}

  /**
   * Create a paginated query with optional filters
   */
  paginated(options: {
    limit?: number
    cursor?: string
    orderBy?: 'asc' | 'desc'
    filter?: (q: any) => any
  }) {
    let query = this.ctx.db.query(this.table)

    if (options.filter) {
      query = query.filter(options.filter)
    }

    query = query.order(options.orderBy ?? 'desc')

    return query.paginate({
      numItems: options.limit ?? 20,
      cursor: options.cursor,
    })
  }

  /**
   * Get recent items (last 7 days)
   */
  recent(limit: number = 50) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    
    return this.ctx.db
      .query(this.table)
      .filter((q) => q.gte(q.field('createdAt'), sevenDaysAgo))
      .order('desc')
      .take(limit)
  }

  /**
   * Search by text field
   */
  search(field: string, query: string, limit: number = 20) {
    return this.ctx.db
      .query(this.table)
      .filter((q) => q.eq(q.field(field as any), query))
      .take(limit)
  }
}

// Usage
export const listMessages = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const factory = new QueryFactory(ctx, 'messages')
    return await factory.paginated({
      limit: 50,
      cursor: args.cursor,
      orderBy: 'desc',
    })
  },
})
```

**Benefits**:
- ✅ Consistent query patterns
- ✅ DRY (Don't Repeat Yourself)
- ✅ Easy to extend with new query types

---

### Middleware/Decorator Pattern

**Purpose**: Add cross-cutting concerns (logging, rate limiting, caching) to functions.

**When to use**: When you need to add behavior to many functions without modifying each one.

#### Example: Rate Limiting Middleware

```typescript
// convex/lib/middleware/rateLimited.ts
import { rateLimiter } from '@convex-dev/rate-limiter'
import type { MutationCtx } from '../_generated/server'

/**
 * Rate limiting decorator for mutations
 */
export function withRateLimit<Args, Output>(
  handler: (ctx: MutationCtx, args: Args) => Promise<Output>,
  options: {
    name: string
    tokens: number
    maxTokens: number
    period: number // milliseconds
  }
) {
  return async (ctx: MutationCtx, args: Args): Promise<Output> => {
    const user = await ctx.auth.getUserIdentity()
    const key = user?.subject ?? 'anonymous'

    // Apply rate limit
    await rateLimiter.limit(ctx, options.name, {
      key,
      tokens: options.tokens,
      maxTokens: options.maxTokens,
      period: options.period,
    })

    // Execute original handler
    return await handler(ctx, args)
  }
}

// Usage
export const sendMessage = mutation({
  args: { content: v.string() },
  handler: withRateLimit(
    async (ctx, args) => {
      // Your logic here
      return await ctx.db.insert('messages', { content: args.content })
    },
    {
      name: 'sendMessage',
      tokens: 1,
      maxTokens: 10,
      period: 60_000, // 10 messages per minute
    }
  ),
})
```

**Benefits**:
- ✅ Add features without modifying core logic
- ✅ Composable (stack multiple decorators)
- ✅ Reusable across many functions

---

## Modularity Principles

### 1. Single Responsibility Principle

Each module should have ONE reason to change.

**❌ Bad** - God object doing everything:
```typescript
export const userMutation = mutation({
  handler: async (ctx, args) => {
    // Validate input
    // Create user
    // Send welcome email
    // Log analytics
    // Update cache
    // Notify admin
  }
})
```

**✅ Good** - Separate concerns:
```typescript
export const registerUser = mutation({
  handler: async (ctx, args) => {
    const validation = new ValidationService()
    const userRepo = new UserRepository(ctx)
    const emailService = new EmailService(ctx)
    const analytics = new AnalyticsService(ctx)

    validation.validateRegistration(args)
    const user = await userRepo.create(args)
    await emailService.sendWelcome(user.email, user.name)
    await analytics.track('user_registered', { userId: user._id })

    return user
  }
})
```

### 2. Dependency Injection

Pass dependencies instead of hard-coding them.

**❌ Bad** - Hard-coded dependency:
```typescript
async function sendEmail(to: string) {
  const resend = new Resend(process.env.RESEND_API_KEY!) // Hard-coded
  await resend.send({ to, ... })
}
```

**✅ Good** - Injected dependency:
```typescript
async function sendEmail(emailService: IEmailService, to: string) {
  await emailService.send({ to, ... }) // Can swap implementations
}
```

### 3. Composition Over Inheritance

Combine small functions instead of creating class hierarchies.

**❌ Bad** - Inheritance:
```typescript
class BaseRepository { /* ... */ }
class UserRepository extends BaseRepository { /* ... */ }
class MessageRepository extends BaseRepository { /* ... */ }
```

**✅ Good** - Composition:
```typescript
function createRepository<T>(ctx: Ctx, table: TableName) {
  return {
    findById: (id) => ctx.db.get(id),
    findAll: () => ctx.db.query(table).collect(),
    // Compose shared behavior
  }
}
```

---

## Reusable Code Patterns

### Shared Validation Schemas

Define validation once, use everywhere.

```typescript
// convex/lib/validation/userSchemas.ts
import { v } from 'convex/values'

export const userEmailSchema = v.string() // Min validation

// For more complex validation, use Zod in actions/http handlers
import { z } from 'zod'

export const registrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
})

// Use in both frontend and backend
export type RegistrationInput = z.infer<typeof registrationSchema>
```

### Custom Error Classes

Create domain-specific errors for better error handling.

```typescript
// convex/lib/errors.ts
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`)
    this.name = 'ValidationError'
  }
}

// Usage
if (!user) {
  throw new AuthenticationError()
}
```

---

## Frontend Architecture

### Custom Hooks Pattern

Encapsulate complex logic in reusable hooks.

```typescript
// src/lib/hooks/useConvexMutation.ts
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { useState } from 'react'
import type { FunctionReference } from 'convex/server'

/**
 * Enhanced mutation hook with toast notifications and error handling
 */
export function useConvexMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation
) {
  const mutate = useMutation(mutation)
  const [isLoading, setIsLoading] = useState(false)

  const execute = async (...args: Parameters<typeof mutate>) => {
    setIsLoading(true)
    try {
      const result = await mutate(...args)
      toast.success('Success!')
      return result
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Something went wrong')
      }
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return { execute, isLoading }
}

// Usage
function MyComponent() {
  const { execute, isLoading } = useConvexMutation(api.messages.send)

  const handleSubmit = async (content: string) => {
    await execute({ content })
  }
}
```

### Route Guards

Protect routes declaratively.

```typescript
// src/lib/patterns/RouteGuards.tsx
import { useSession } from '@/lib/auth-client'
import { Navigate } from '@tanstack/react-router'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <Navigate to="/login" />

  return <>{children}</>
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  if (!session?.user?.role === 'admin') {
    return <Navigate to="/" />
  }

  return <>{children}</>
}

// Usage in routes
export const Route = createFileRoute('/dashboard')({
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
})
```

---

## Error Handling Strategies

### Backend Error Handling

```typescript
// convex/lib/errors/errorHandler.ts
export function handleError(error: unknown): never {
  if (error instanceof AuthenticationError) {
    throw new Error('Please sign in to continue')
  }
  
  if (error instanceof AuthorizationError) {
    throw new Error('You do not have permission for this action')
  }

  if (error instanceof ValidationError) {
    throw new Error(`Validation failed: ${error.message}`)
  }

  // Log unexpected errors (use Sentry in production)
  console.error('Unexpected error:', error)
  throw new Error('An unexpected error occurred')
}

// Usage
export const myMutation = mutation({
  handler: async (ctx, args) => {
    try {
      // Your logic
    } catch (error) {
      handleError(error)
    }
  },
})
```

### Frontend Error Handling

```typescript
// src/lib/patterns/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## Summary

### Key Takeaways

1. **Organize by domain**, not by technical layer
2. **Use repositories** for complex data access
3. **Use adapters** for external services
4. **Apply middleware** for cross-cutting concerns
5. **Inject dependencies** for testability
6. **Create custom hooks** for reusable frontend logic
7. **Handle errors consistently** with custom error classes

### When to Apply These Patterns

| Pattern | When to Use |
|---------|-------------|
| **Repository** | Complex queries used in multiple places |
| **Adapter** | External API integration |
| **Factory** | Creating similar objects repeatedly |
| **Middleware** | Adding behavior to many functions |
| **Custom Hooks** | Reusing frontend logic |

### Further Reading

- [Convex Best Practices](https://docs.convex.dev/production/best-practices)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Patterns](https://www.patterns.dev/react)

---

**Remember**: Start simple. Only add patterns when you feel the pain of repetition. Don't over-engineer early.
