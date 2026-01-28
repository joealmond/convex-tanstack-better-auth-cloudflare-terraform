# Frontend Pattern Examples

This directory contains **reference implementations** of frontend patterns for React + TanStack + Convex.

## 📋 Important Note

These files are **examples and templates** meant to be copied and customized. They may show TypeScript errors because they reference types that need to be customized for your application.

**This is intentional!** These are educational references.

## 🎯 Available Patterns

### `useConvexMutation.ts`
Enhanced mutation hooks with:
- Automatic toast notifications
- Loading states
- Error handling
- Optimistic updates
- Debouncing
- Batching

**Usage:**
```typescript
import { useConvexMutation } from '@/lib/patterns/useConvexMutation'

const sendMessage = useConvexMutation(api.messages.send, {
  successMessage: 'Message sent!',
  showSuccessToast: true,
})

await sendMessage.execute({ content: 'Hello' })
```

### `RouteGuards.tsx`
Declarative route protection:
- `RequireAuth` - Authenticated users only
- `RequireAdmin` - Admin role required
- `RequireRole` - Specific role(s) required
- `RequireGuest` - Logged-out users only
- `RequireSubscription` - Active subscription required
- `RequireFeature` - Feature flag enabled

**Usage:**
```typescript
<RequireAuth>
  <DashboardPage />
</RequireAuth>
```

### `FormFactory.tsx`
Generate forms from Zod schemas:
- Type-safe forms
- Automatic validation
- Consistent styling
- Less boilerplate

**Usage:**
```typescript
const LoginForm = createForm({
  schema: loginSchema,
  onSubmit: async (data) => { /* ... */ },
  fields: { /* field config */ },
})
```

## 📖 Learn More

See [`/docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md) for detailed explanations and best practices.

---

**Remember**: These are optional enhancements. Use them when they simplify your code, not just because they exist!
