# AI Assistant Guidelines

Best practices for working with AI coding assistants (GitHub Copilot, Claude, Cursor, etc.) on this codebase.

## 🎯 Quick Reference: Copy-Paste Prompts

Use these prompts when asking AI to generate code for this project:

### When Starting a New Feature

```
Create a new feature for [FEATURE_NAME]. Requirements:
- Split code into separate files (components, hooks, utils)
- Reuse existing components from src/components/
- Follow the existing patterns in this codebase
- Keep each file under 200 lines
- Use TypeScript with proper types
```

### When Creating UI Components

```
Create a [COMPONENT_NAME] component. Requirements:
- Extract into src/components/[ComponentName].tsx
- Use existing UI primitives (if shadcn/ui is installed)
- Make it reusable with proper props interface
- Follow mobile-first responsive design
- Handle loading and error states
```

### When Adding Convex Functions

```
Add a Convex [query/mutation] for [FEATURE]. Requirements:
- Use convex/values validators (v.string(), etc.) - NOT Zod
- Add proper TypeScript types
- Use requireAuth/requireAdmin from lib/authHelpers if auth needed
- Keep mutations focused (single responsibility)
- Add JSDoc comments
```

---

## 📁 File Organization Rules

### ❌ DON'T: Create Monolithic Files

AI tends to generate everything in one massive file. Prevent this by being explicit:

```
❌ Bad prompt: "Create a dashboard with charts and data tables"
✅ Good prompt: "Create a dashboard feature. Split into:
   - src/routes/dashboard.tsx (route component)
   - src/components/dashboard/StatsCards.tsx
   - src/components/dashboard/DataTable.tsx
   - src/components/dashboard/Chart.tsx
   - src/hooks/useDashboardData.ts
   - convex/dashboard.ts (backend queries)"
```

### Project Structure Reference

```
src/
├── components/         # Reusable UI components
│   ├── ui/            # Base primitives (Button, Input, etc.)
│   └── [Feature]/     # Feature-specific components
├── hooks/             # Custom React hooks
├── lib/               # Utility functions
├── routes/            # TanStack Router pages
└── styles/            # Global CSS

convex/
├── lib/               # Shared backend utilities
│   ├── authHelpers.ts # Auth utilities
│   └── config.ts      # App configuration
├── [feature].ts       # Feature-specific functions
└── schema.ts          # Database schema
```

---

## 🔄 Reusability Checklist

Before accepting AI-generated code, check:

- [ ] **Headers/Navigation**: Are they in a shared component or duplicated?
- [ ] **Buttons**: Using a base `Button` component with variants?
- [ ] **Form inputs**: Consistent styling across all forms?
- [ ] **Loading states**: Using a shared `Loader` or `Skeleton`?
- [ ] **Error handling**: Centralized `ErrorBoundary`?

### Prompt for Extracting Duplicates

```
I see duplicated [component/logic] across [files].
Extract into a reusable component at src/components/[Name].tsx
and update all usages.
```

---

## 📱 Mobile & Responsive Design

AI often forgets mobile considerations. Include these in your prompts:

### Keyboard Handling

```
For this form component:
- Handle keyboard avoidance (input shouldn't be covered)
- Add proper input modes (email, tel, numeric)
- Include touch-friendly tap targets (min 44px)
```

### Responsive Layouts

```
Make this component responsive:
- Mobile-first approach
- Stack on mobile, side-by-side on desktop
- Use Tailwind responsive prefixes (sm:, md:, lg:)
- Test at 320px, 768px, 1024px widths
```

---

## ⚡ Convex-Specific Guidelines

### Validators: Use `v`, NOT Zod

```typescript
// ✅ CORRECT - Convex native validators
import { v } from 'convex/values'

export const myMutation = mutation({
  args: {
    name: v.string(),
    age: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => { ... }
})

// ❌ WRONG - Zod doesn't work in Convex functions
import { z } from 'zod'  // Don't use for Convex args!
```

### Auth: Use the Helpers

```typescript
// ✅ CORRECT
import { requireAuth, requireAdmin } from './lib/authHelpers'

export const myMutation = mutation({
  handler: async (ctx) => {
    const user = await requireAuth(ctx) // Throws if not logged in
    // ...
  },
})
```

### File Naming

```
✅ Allowed: myFunction.ts, my_function.ts, my.function.ts
❌ Not allowed: my-function.ts (hyphens break Convex)
```

---

## 🚫 Over-Engineering Prevention

### Simple Features = Simple Solutions

| Feature       | ❌ Over-engineered       | ✅ Simple Solution          |
| ------------- | ------------------------ | --------------------------- |
| Health check  | Custom monitoring system | Static `/health` endpoint   |
| Feature flags | Full flag service        | `config.ts` with booleans   |
| Logging       | Elk stack integration    | `console.log` + Convex logs |
| Caching       | Redis setup              | Convex's built-in caching   |

### Prompt to Prevent Over-Engineering

```
Implement [FEATURE] using the simplest possible approach.
- Use built-in capabilities first
- No external services unless absolutely required
- Prefer configuration files over complex systems
- Maximum 50 lines of code for this feature
```

---

## 🔧 Refactoring Prompts

When AI code gets messy, use these:

### Fix Nested Container Hell

```
Refactor this component to:
- Flatten the DOM structure (max 4 levels deep)
- Extract nested components into separate files
- Use CSS Grid/Flexbox instead of nested divs
- Remove unnecessary wrapper elements
```

### Clean Up Styling

```
Clean up the styling in this component:
- Use Tailwind utility classes consistently
- Remove inline styles
- Extract repeated patterns to @apply or components
- Ensure dark mode compatibility
```

### Simplify Complex Logic

```
This function is too complex. Refactor to:
- Split into smaller, single-purpose functions
- Extract into a custom hook if it's React state logic
- Add early returns to reduce nesting
- Maximum 20 lines per function
```

---

## 🎨 UI Component Patterns

### Consistent Component Structure

```tsx
// Template for new components
interface MyComponentProps {
  // Required props first
  title: string
  // Optional props with defaults
  variant?: 'default' | 'primary'
  className?: string
  // Event handlers
  onClick?: () => void
  // Children last
  children?: React.ReactNode
}

export function MyComponent({
  title,
  variant = 'default',
  className,
  onClick,
  children,
}: MyComponentProps) {
  return <div className={cn('base-styles', className)}>{/* Component content */}</div>
}
```

### Prompt for New Components

```
Create [ComponentName] following this structure:
1. TypeScript interface for props at the top
2. Destructure props with defaults
3. Use cn() utility for className merging
4. Export as named function (not default)
5. Keep under 100 lines
```

---

## 🧪 Testing Prompts

```
Add tests for [component/function]:
- Unit tests for pure functions
- Integration tests for Convex functions (use convex-test)
- Component tests with React Testing Library
- Focus on user behavior, not implementation
```

---

## 📋 Pre-Commit Checklist

Before accepting AI-generated code:

1. **File size**: No file over 300 lines?
2. **Imports**: All imports from existing project structure?
3. **Types**: Full TypeScript types, no `any`?
4. **Reusability**: Common patterns extracted?
5. **Mobile**: Responsive and touch-friendly?
6. **Auth**: Protected routes use auth helpers?
7. **Convex**: Using `v` validators, not Zod?
8. **Naming**: No hyphens in Convex file names?

---

## 💡 General Tips

1. **Be specific**: "Create a button" → "Create a Button component with primary/secondary/ghost variants"

2. **Reference existing code**: "Follow the pattern in src/components/AdminToolbar.tsx"

3. **Set constraints**: "Maximum 150 lines" or "No external dependencies"

4. **Ask for explanations**: "Explain why you chose this approach"

5. **Iterate in small steps**: Don't ask for entire features at once

6. **Review diffs**: Always check what changed before accepting

7. **Test immediately**: Run the app after each AI change

---

## 🔗 Project-Specific Patterns

### Authentication Check (Frontend)

```tsx
import { useAdmin } from '@/hooks/use-admin'

function MyComponent() {
  const { isAdmin, isLoading } = useAdmin()

  if (isLoading) return <Loader />
  if (!isAdmin) return <AccessDenied />

  return <AdminContent />
}
```

### Protected Mutation (Backend)

```typescript
import { requireAdmin } from './lib/authHelpers'

export const adminAction = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)  // Will throw if not admin
    // ... admin-only logic
  }
})
```

### Real-time Query (Frontend)

```tsx
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'

function MyComponent() {
  const { data, isLoading } = useQuery(convexQuery(api.myModule.myQuery, { arg: 'value' }))
}
```
