# Feature Examples

Each example is intended to stay small and removable: one route, one Convex module when needed, and a focused doc section.

| Example             | Route               | Backend                                        |
| ------------------- | ------------------- | ---------------------------------------------- |
| Realtime chat       | `/examples/chat`    | `convex/messages.ts`                           |
| File uploads        | `/examples/files`   | `convex/files.ts`                              |
| Admin / RBAC        | `/examples/admin`   | `convex/users.ts`, `convex/lib/authHelpers.ts` |
| Forms               | `/examples/forms`   | Frontend-only                                  |
| Todos + data table  | `/examples/todos`   | `convex/todos.ts`                              |
| AI streaming        | `/examples/ai`      | `convex/ai.ts`                                 |
| Stripe billing      | `/examples/billing` | `convex/stripe.ts`, `convex/billing.ts`        |
| Transactional email | `/examples/email`   | `convex/emails.ts`, `convex/emailActions.ts`   |

## Realtime Chat

Realtime chat demonstrates public Convex queries and mutations, optional auth-aware names, rate limiting, SSR data preloading, and admin-aware deletion controls.

## File Uploads

File uploads demonstrate Convex storage upload URLs, metadata persistence, authenticated ownership, file size validation, and download URL generation.

## Admin / RBAC

Admin / RBAC demonstrates email whitelist-based admin detection, effective-role checks, and the built-in "view as user" impersonation mode.

## Forms

Forms demonstrate React Hook Form with Zod validation, field-level errors, disabled submit states, and a route that can be copied into a real contact or onboarding flow.

## Todos and Data Table

Todos demonstrate authenticated ownership, cursor pagination, TanStack Table sorting, and an
optimistic completion mutation that rolls back on failure.

## AI Streaming

AI streaming uses a Convex action to consume the OpenAI Responses API SSE stream, batches deltas
into persisted output, and lets subscriptions update the UI without exposing the API key.

## Stripe Billing

Billing demonstrates server-owned price configuration, hosted Checkout and customer portal
sessions, raw-body webhook verification, event idempotency, and realtime subscription state.

## Transactional Email

Email demonstrates a Better Auth post-create hook, scheduled Resend action, escaped HTML, and
persisted queued/sent/error delivery status.
