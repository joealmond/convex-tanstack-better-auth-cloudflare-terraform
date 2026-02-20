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
    return await this.ctx.db.query('users').order('desc').paginate({ numItems: limit, cursor })
  }
}

// Usage in a Convex function
export const getUser = publicQuery({
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
export const registerUser = authMutation({
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
export const listMessages = publicQuery({
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
export const sendMessage = authMutation({
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

## Convex Component Patterns

### Scalable Aggregates (`@convex-dev/aggregate`)

**Purpose**: Keep track of sums and counts in a denormalized, scalable way without scanning tables.

**When to use**: Whenever you need a `count` or a `sum` of records (e.g. number of users, votes cast, followers) instead of `db.query(...).collect().length`.

#### Example: Track Vote Counts

```typescript
// convex/aggregates.ts
import { TableAggregate } from '@convex-dev/aggregate'

export const votesAggregate = new TableAggregate(components.votesAggregate, {
  sortKey: (doc) => doc.productId,
})

// Usage in mutation
export const castVote = authMutation({
  handler: async (ctx, args) => {
    const voteId = await ctx.db.insert('votes', args)
    const newVote = await ctx.db.get(voteId)
    if (newVote) await votesAggregate.insert(ctx, newVote)
  },
})

// Usage in query (Fast O(log n))
export const getVoteCount = publicQuery({
  handler: async (ctx, args) => {
    return await votesAggregate.count(ctx, { prefix: [args.productId] })
  },
})
```

### Async Triggers (Side Effects)

**Purpose**: Decouple slow or complex gamification, notification, and profile progression logic from main CRUD mutations.

**When to use**: When an action (like `createProduct`) has multiple side effects (e.g., award points, send email, trigger AI) that shouldn't block the UI response.

#### Example: `sideEffects.ts`

```typescript
// convex/sideEffects.ts
import { internalMutation } from './lib/customFunctions'

export const onVoteCast = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    // 1. Give points
    // 2. Update streak
    // 3. Check badges
  },
})

// Usage in main mutation
export const castVote = authMutation({
  handler: async (ctx, args) => {
    // ... insert vote
    // Trigger side effects asynchronously
    await ctx.scheduler.runAfter(0, internal.sideEffects.onVoteCast, { userId: args.userId })
  },
})
```

---

## Modularity Principles

### 1. Single Responsibility Principle

Each module should have ONE reason to change.

**❌ Bad** - God object doing everything:

```typescript
export const userMutation = authMutation({
  handler: async (ctx, args) => {
    // Validate input
    // Create user
    // Send welcome email
    // Log analytics
    // Update cache
    // Notify admin
  },
})
```

**✅ Good** - Separate concerns:

```typescript
export const registerUser = authMutation({
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
  },
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
class BaseRepository {
  /* ... */
}
class UserRepository extends BaseRepository {
  /* ... */
}
class MessageRepository extends BaseRepository {
  /* ... */
}
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

  if (session?.user?.role !== 'admin') {
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

All custom function wrappers from `lib/customFunctions.ts` include a **global exception filter** that:

1. Logs errors via `console.error` (visible in Convex dashboard logs)
2. Normalizes all errors to `ConvexError` for safe client transport

For domain-specific errors, use `ConvexError` directly:

```typescript
import { ConvexError } from 'convex/values'
import { authMutation } from './lib/customFunctions'

export const myMutation = authMutation({
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id)
    if (!item) throw new ConvexError('Item not found')
    if (item.userId !== ctx.userId) throw new ConvexError('Not authorized')
    // ... mutation logic
  },
})
```

The global exception filter in `customFunctions.ts` catches any unhandled errors automatically — you don't need manual try/catch in every handler.

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
    logger.error('Error caught by boundary', error, { componentStack: errorInfo.componentStack })
    // Dispatched to Sentry automatically in production
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

| Pattern          | When to Use                             |
| ---------------- | --------------------------------------- |
| **Repository**   | Complex queries used in multiple places |
| **Adapter**      | External API integration                |
| **Factory**      | Creating similar objects repeatedly     |
| **Middleware**   | Adding behavior to many functions       |
| **Custom Hooks** | Reusing frontend logic                  |

### Further Reading

- [Convex Best Practices](https://docs.convex.dev/production/best-practices)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Patterns](https://www.patterns.dev/react)

---

## TanStack Start Entry Points (v1.154+)

As of TanStack Start v1.154+, the client and server entry points have been simplified. Using the old patterns will cause build errors.

### Client Entry Point (`src/start.tsx`)

```typescript
// ✅ v1.154+ — framework handles hydration automatically
export const startInstance = undefined

// ❌ Old pattern — do NOT use
// import { hydrateRoot } from 'react-dom/client'
// hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)
```

### Server Entry Point (`src/server.ts`)

```typescript
// ✅ v1.154+ — use default handler, no manual router passing
import handler from '@tanstack/react-start/server-entry'

export default {
  fetch(request: Request) {
    return handler.fetch(request)
  },
}

// ❌ Old pattern — do NOT use
// import { createStartHandler } from '@tanstack/react-start'
// const handler = createStartHandler({ router })
```

---

## Cloudflare Workers Gotchas

### `nodejs_compat_v2` Flag

The Cloudflare Vite plugin automatically adds `nodejs_compat`. If you also specify it manually in `wrangler.jsonc`, you'll get a duplicate flag error. Use `nodejs_compat_v2` instead:

```jsonc
{
  "compatibility_flags": ["nodejs_compat_v2"],
}
```

### No Dynamic `import.meta.env` Access

Cloudflare Workers' build pipeline statically analyzes `import.meta.env` references. Casting `import.meta` to `any` and then accessing `.env` dynamically will fail:

```typescript
// ❌ Breaks in Cloudflare Workers
const url = (import.meta as any).env.VITE_CONVEX_URL

// ✅ Works everywhere — direct property access
const url = import.meta.env.VITE_CONVEX_URL
```

### No `Buffer` in Convex V8 Runtime

The Convex runtime uses V8, which doesn't have Node.js `Buffer`. Use web-standard APIs:

```typescript
// ❌ Not available in Convex
Buffer.from(data).toString('base64')

// ✅ Use web-standard btoa()
btoa(String.fromCharCode(...new Uint8Array(data)))
```

---

## Convex Schema: Better Auth User IDs

When using Better Auth with Convex, user IDs in the schema must be strings, not Convex document IDs. Better Auth manages its own user table with string UUIDs.

```typescript
// ✅ Correct — Better Auth IDs are strings
votes: defineTable({
  userId: v.optional(v.string()),
  productId: v.id('products'),
}),

profiles: defineTable({
  userId: v.string(),  // String, not v.id('users')!
}),

// ❌ Wrong — will cause type errors
votes: defineTable({
  userId: v.id('users'),  // Better Auth doesn't use Convex IDs
}),
```

---

## Environment Validation with Zod

Validate all environment variables at startup to fail fast with clear error messages:

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_CONVEX_URL: z.string().url(),
  VITE_CONVEX_SITE_URL: z.string().url().optional(),
})

const serverEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SITE_URL: z.string().url(),
})

export const env = envSchema.parse(import.meta.env)

// Auto-derive SITE_URL from CONVEX_URL if not set
export const convexSiteUrl =
  env.VITE_CONVEX_SITE_URL ?? env.VITE_CONVEX_URL.replace('.cloud', '.site')
```

---

## Recommended Patterns

### Anonymous User ID Management

For apps with anonymous features (voting, commenting before sign-up):

```typescript
// src/hooks/use-anonymous-id.ts
const ANON_ID_KEY = 'anonymous_user_id'

export function useAnonymousId() {
  const [anonId, setAnonId] = useState<string | null>(null)

  useEffect(() => {
    let id = localStorage.getItem(ANON_ID_KEY)
    if (!id) {
      id = `anon_${crypto.randomUUID()}`
      localStorage.setItem(ANON_ID_KEY, id)
    }
    setAnonId(id)
  }, [])

  return { anonId, clearAnonId: () => localStorage.removeItem(ANON_ID_KEY) }
}
```

Migrate anonymous data on sign-up:

```typescript
// convex/votes.ts
export const migrateAnonymousVotes = authMutation({
  args: { anonymousId: v.string() },
  handler: async (ctx, { anonymousId }) => {
    // ctx.user and ctx.userId are auto-injected
    const anonVotes = await ctx.db
      .query('votes')
      .withIndex('by_anonymous_id', (q) => q.eq('anonymousId', anonymousId))
      .collect()
    for (const vote of anonVotes) {
      await ctx.db.patch(vote._id, {
        userId: ctx.userId,
        anonymousId: undefined,
        isAnonymous: false,
      })
    }
  },
})
```

### Geolocation Hook

```typescript
// src/hooks/use-geolocation.ts
export function useGeolocation() {
  const [state, setState] = useState<{
    loading: boolean
    error: string | null
    coords: { latitude: number; longitude: number } | null
  }>({ loading: false, error: null, coords: null })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation not supported' }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          loading: false,
          error: null,
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        }),
      (err) => setState({ loading: false, error: err.message, coords: null }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { ...state, requestLocation }
}
```

---

**Remember**: Start simple. Only add patterns when you feel the pain of repetition. Don't over-engineer early.
