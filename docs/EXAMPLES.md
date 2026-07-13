# Feature Examples

Each example is intended to stay small and removable: one route, one Convex module when needed, and a focused doc section.

| Example       | Route             | Backend                                        |
| ------------- | ----------------- | ---------------------------------------------- |
| Realtime chat | `/examples/chat`  | `convex/messages.ts`                           |
| File uploads  | `/examples/files` | `convex/files.ts`                              |
| Admin / RBAC  | `/examples/admin` | `convex/users.ts`, `convex/lib/authHelpers.ts` |
| Forms         | `/examples/forms` | Frontend-only                                  |

## Realtime Chat

Realtime chat demonstrates public Convex queries and mutations, optional auth-aware names, rate limiting, SSR data preloading, and admin-aware deletion controls.

## File Uploads

File uploads demonstrate Convex storage upload URLs, metadata persistence, authenticated ownership, file size validation, and download URL generation.

## Admin / RBAC

Admin / RBAC demonstrates email whitelist-based admin detection, effective-role checks, and the built-in "view as user" impersonation mode.

## Forms

Forms demonstrate React Hook Form with Zod validation, field-level errors, disabled submit states, and a route that can be copied into a real contact or onboarding flow.
