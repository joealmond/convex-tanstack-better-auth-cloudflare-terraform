# Design Pattern Examples

This directory contains **reference implementations** of common design patterns adapted for the Convex + TanStack ecosystem.

## 📋 Important Note

These files are **examples and templates** meant to be copied and customized for your specific use case. They may show TypeScript errors in your IDE because they reference types and structures that don't exist yet in your application.

**This is intentional!** These are educational references, not production code.

## 🎯 How to Use These Patterns

1. **Read the documentation** in `/docs/ARCHITECTURE.md` first
2. **Copy** the pattern file you need
3. **Customize** it for your specific domain and requirements
4. **Integrate** it into your application

## 📦 Available Patterns

### `Repository.ts`
- **Purpose**: Abstract data access logic
- **Use when**: You have complex queries you'll reuse across multiple functions
- **Example**: `UserRepository`, `MessageRepository`, `FileRepository`

### `ServiceAdapter.ts`
- **Purpose**: Wrap external services (email, payments, AI)
- **Use when**: Integrating third-party APIs or when you might swap services
- **Example**: `EmailService`, `PaymentService` with mock implementations

### `Factory.ts`
- **Purpose**: Create objects with consistent configuration
- **Use when**: Building similar objects repeatedly or creating reusable query patterns
- **Example**: `QueryFactory`, `ValidationSchemaFactory`, `ResponseFactory`

## ⚠️ TypeScript Errors?

If you see TypeScript errors in these files, **don't worry!** These are reference files that use placeholder types and imports.

To use them:
1. Copy the pattern you need to your actual code
2. Update the imports to match your project structure
3. Customize the types to match your schema
4. The errors will disappear as you integrate them

## 📖 Learn More

See [`/docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md) for:
- Detailed explanations of each pattern
- When to use (and when NOT to use) each pattern
- Best practices for modular code
- Error handling strategies
- Frontend architecture patterns

## 🚀 Quick Example

```typescript
// 1. Copy Repository.ts pattern
// 2. Customize for your domain

export class ProductRepository extends Repository<'products'> {
  constructor(ctx: Ctx) {
    super(ctx, 'products')
  }

  async findByCategory(category: string) {
    return await this.ctx.db
      .query('products')
      .withIndex('by_category', (q) => q.eq('category', category))
      .collect()
  }
}

// 3. Use in your Convex functions
export const getProducts = query({
  handler: async (ctx, args) => {
    const repo = new ProductRepository(ctx)
    return await repo.findByCategory(args.category)
  },
})
```

---

**Remember**: These patterns are optional! Start simple, and only add patterns when you feel the pain of repetition. Don't over-engineer early.
