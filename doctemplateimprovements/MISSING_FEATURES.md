# Missing Features

Features that should be added to the `convex-tanstack-cloudfare` template to make it more production-ready.

---

## 1. UI Component Library (shadcn/ui)

### Issue
The template provides no pre-built UI components. Everything must be built from scratch.

### Why It Matters
- Production apps need buttons, dialogs, forms, toasts, etc.
- Building these from scratch is time-consuming and error-prone
- shadcn/ui is the de facto standard for modern React apps

### Suggested Solution
Add shadcn/ui with common components:

```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog input toast form
```

**Files to add:**
- `components.json` - shadcn configuration
- `src/components/ui/` - UI component directory
- `src/lib/shadcn-utils.ts` - cn() helper (separate from main utils)

---

## 2. Testing Infrastructure

### Issue
No tests, no test scripts, no testing libraries configured.

### Why It Matters
- CI/CD workflow references tests but they don't exist
- Production apps require testing for reliability
- Makes it hard to refactor with confidence

### Suggested Solution
Add Vitest + React Testing Library + Playwright:

**package.json additions:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "vitest": "^3.x.x",
    "@testing-library/react": "^16.x.x",
    "@playwright/test": "^1.x.x"
  }
}
```

**Files to add:**
- `vitest.config.ts`
- `playwright.config.ts`
- `src/__tests__/` directory
- `e2e/` directory

---

## 3. Form Handling

### Issue
No form library integration for complex forms.

### Why It Matters
- Real apps have signup forms, product forms, settings forms
- Manual form handling is verbose and error-prone
- Validation feedback needs consistent patterns

### Suggested Solution
Add react-hook-form with Zod integration:

**package.json addition:**
```json
{
  "dependencies": {
    "react-hook-form": "^7.x.x",
    "@hookform/resolvers": "^3.x.x"
  }
}
```

**Example pattern to document:**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(schema)
  })
  // ...
}
```

---

## 4. Toast Notifications

### Issue
Template mentions Sonner in docs but doesn't include it.

### Why It Matters
- Users need feedback for actions (save, delete, errors)
- Toast is standard UX pattern
- Easy to add but missing

### Suggested Solution
Add Sonner:

**package.json addition:**
```json
{
  "dependencies": {
    "sonner": "^2.x.x"
  }
}
```

**src/routes/__root.tsx addition:**
```tsx
import { Toaster } from 'sonner'

export function RootLayout() {
  return (
    <>
      {/* ... existing content */}
      <Toaster />
    </>
  )
}
```

---

## 5. Protected Routes Pattern

### Issue
Only 2 routes exist, no example of auth-protected routes.

### Why It Matters
- Most apps have protected areas (dashboard, profile, admin)
- TanStack Router has specific patterns for this
- New developers need examples

### Suggested Solution
Add a protected route example:

**src/routes/_authenticated.tsx:**
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />
})
```

**src/routes/_authenticated/dashboard.tsx:**
```tsx
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard
})

function Dashboard() {
  return <div>Protected content</div>
}
```

---

## 6. Error and 404 Routes

### Issue
No error handling routes or 404 page.

### Why It Matters
- Users hitting invalid URLs see broken page
- Errors need graceful handling
- Standard web app requirement

### Suggested Solution
Add error routes:

**src/routes/_404.tsx or similar:**
```tsx
export const Route = createFileRoute('/_404')({
  component: NotFound
})

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">404</h1>
      <p>Page not found</p>
    </div>
  )
}
```

---

## 7. Charts/Visualization Library

### Issue
No charting library for data visualization.

### Why It Matters
- Many apps need charts, graphs, dashboards
- Recharts is popular and easy to use
- Common requirement for business apps

### Suggested Solution
Add Recharts (optional in template docs):

```json
{
  "dependencies": {
    "recharts": "^3.x.x"
  }
}
```

Document usage in OPTIONAL_FEATURES.md.

---

## 8. Internationalization (i18n)

### Issue
No internationalization support.

### Why It Matters
- Global apps need multiple languages
- Adding i18n later is painful (refactoring all strings)
- Better to have pattern from start

### Suggested Solution
Document i18n pattern with simple approach:

**src/lib/i18n.ts:**
```typescript
import en from '@/locales/en.json'
import es from '@/locales/es.json'

const locales = { en, es }

export function useTranslation() {
  const locale = localStorage.getItem('locale') || 'en'
  return locales[locale as keyof typeof locales]
}
```

---

## 9. Database Seeding Script

### Issue
No way to populate database with test data.

### Why It Matters
- Development needs realistic data
- Testing needs reproducible data
- Onboarding new developers is easier with data

### Suggested Solution
Add seed script:

**convex/seed.ts:**
```typescript
import { mutation } from './_generated/server'

export const seedData = mutation({
  handler: async (ctx) => {
    // Insert sample messages
    await ctx.db.insert('messages', {
      content: 'Hello World!',
      authorId: 'system',
      authorName: 'System',
      createdAt: Date.now()
    })
    // ... more seed data
  }
})
```

**package.json:**
```json
{
  "scripts": {
    "seed": "npx convex run seed:seedData"
  }
}
```

---

## 10. Rate Limiting Component

### Issue
No rate limiting for API endpoints.

### Why It Matters
- Production APIs need protection from abuse
- Convex has official rate limiter component
- Should be demonstrated in template

### Suggested Solution
Add @convex-dev/rate-limiter:

```json
{
  "dependencies": {
    "@convex-dev/rate-limiter": "^0.3.x"
  }
}
```

Document usage in convex/README.md.

---

## Priority Matrix

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| shadcn/ui | Medium | High | 🔴 Critical |
| Testing | High | High | 🔴 Critical |
| Toast Notifications | Low | Medium | 🟡 High |
| Protected Routes | Low | High | 🟡 High |
| Form Handling | Medium | High | 🟡 High |
| 404/Error Routes | Low | Medium | 🟢 Medium |
| i18n | Medium | Medium | 🟢 Medium |
| Seed Script | Low | Medium | 🟢 Medium |
| Rate Limiting | Low | Medium | 🟢 Medium |
| Charts | Low | Low | ⚪ Optional |
