# Rate Limiting Guide

This template includes comprehensive two-layer rate limiting to protect your application from abuse and ensure fair usage.

## Two-Layer Defense Strategy

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Layer 1: Cloudflare (Optional) │  ← Broad IP-based protection
│  • 1000 req/min per IP          │     (DDoS, malicious traffic)
│  • Block known bad actors       │
│  • Requires paid Cloudflare plan│
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Layer 2: Convex ✅             │  ← Granular user-aware limits
│  • 10 messages/min per user     │     (Business logic protection)
│  • 5 file uploads/min per user  │
│  • Premium users get 10x limits │
│  • Built-in, free, type-safe    │
└─────────────────────────────────┘
```

## Quick Start

### Basic Usage

Apply rate limiting to any mutation using the middleware decorator:

```typescript
import { mutation } from './_generated/server'
import { withRateLimit } from './lib/middleware/withRateLimit'

export const sendMessage = mutation({
  args: { content: v.string() },
  handler: withRateLimit(
    async (ctx, args, user) => {
      // user is automatically authenticated
      await ctx.db.insert('messages', {
        content: args.content,
        authorId: user._id,
      })
    },
    'SEND_MESSAGE' // 10 messages per minute
  ),
})
```

### Pre-configured Decorators

Use convenience decorators for common scenarios:

```typescript
import {
  withStandardRateLimit, // 60 req/min
  withStrictRateLimit,   // 10 req/min
  withFileUploadLimit,   // 5 uploads/min
  withAuthRateLimit,     // 5 attempts/min
} from './lib/middleware/withRateLimit'

// Standard limit for API calls
export const getData = mutation({
  handler: withStandardRateLimit(async (ctx, args, user) => {
    // Your logic here
  }),
})

// Strict limit for expensive operations
export const sendEmail = mutation({
  handler: withStrictRateLimit(async (ctx, args, user) => {
    // Send email logic
  }),
})
```

## Configuration

### Centralized Limits

All rate limits are defined in [`convex/lib/constants/rateLimits.ts`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/lib/constants/rateLimits.ts):

```typescript
export const RATE_LIMITS = {
  SEND_MESSAGE: {
    tokens: 1,
    maxTokens: 10,      // 10 messages
    period: 60 * 1000,  // per minute
  },
  UPLOAD_FILE: {
    tokens: 1,
    maxTokens: 5,       // 5 uploads
    period: 60 * 1000,  // per minute
  },
  // ... more limits
}
```

### Role-Based Limits

Premium users and admins automatically get higher limits:

```typescript
export const ROLE_MULTIPLIERS = {
  user: 1,        // Standard: 10 messages/min
  premium: 5,     // Premium: 50 messages/min (5x)
  admin: 100,     // Admin: 1000 messages/min (100x)
}
```

The middleware automatically detects user roles from Better Auth.

### Custom Key Function

Rate limit by something other than user ID:

```typescript
export const mutation = mutation({
  handler: withRateLimit(
    async (ctx, args, user) => {
      // Your logic
    },
    'API_CALL',
    {
      // Rate limit by IP or organization
      getKey: (ctx, args, user) => user.organizationId,
      // Custom role calculation
      getRole: (user) => user.isPremium ? 'premium' : 'user',
    }
  ),
})
```

## Architecture Patterns Used

This rate limiting implementation showcases the template's architecture patterns:

### Service Adapter Pattern

[`RateLimitService`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/lib/services/rateLimitService.ts) wraps `@convex-dev/rate-limiter`:

- ✅ Easy to swap implementations (production vs mock)
- ✅ Testable (mock service for tests)
- ✅ Centralized logic

### Middleware/Decorator Pattern

[`withRateLimit()`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/lib/middleware/withRateLimit.ts) adds rate limiting without modifying core logic:

- ✅ Reusable across mutations
- ✅ Separates concerns
- ✅ Easy to compose with other middleware

## Cloudflare Rate Limiting (Optional)

If you're on a **Cloudflare paid plan**, add Layer 1 protection:

### Via Cloudflare Dashboard

1. Go to your zone → **Security** → **WAF**
2. Create a rate limiting rule:
   - **Requests matching**: `(http.request.uri.path contains "/api/")`
   - **Characteristics**: `IP Address`
   - **Rate**: `1000 requests per 1 minute`
   - **Action**: `Challenge` or `Block`
   - **Duration**: `10 minutes`

### Via Terraform

If using the included Terraform setup:

```hcl
# infrastructure/cloudflare.tf
resource "cloudflare_rate_limit" "api_protection" {
  zone_id = var.cloudflare_zone_id
  
  threshold = 1000  # requests
  period    = 60    # seconds
  
  match {
    request {
      url_pattern = "*/api/*"
    }
  }
  
  action {
    mode    = "challenge"  # Show CAPTCHA
    timeout = 600          # 10 minutes
  }
}
```

Then deploy:

```bash
cd infrastructure
terraform apply
```

### Why Add Cloudflare Layer?

| Scenario | Cloudflare Needed? |
|----------|-------------------|
| Public API with high traffic | ✅ Yes - Protects infrastructure |
| Internal tool, low traffic | ❌ No - Convex layer is sufficient |
| Expecting bot attacks | ✅ Yes - Blocks at edge |
| Tight budget | ❌ No - Free tier doesn't include rate limiting |

## Testing

### Unit Tests

Mock rate limit service in tests:

```typescript
import { MockRateLimitService } from '@/convex/lib/services/rateLimitService'

test('rate limiting works', async () => {
  const service = new MockRateLimitService()
  
  await service.checkLimit('SEND_MESSAGE', 'user-123')
  
  expect(service.getChecks()).toHaveLength(1)
  expect(service.getChecks()[0]).toEqual({
    operation: 'SEND_MESSAGE',
    key: 'user-123',
    role: 'user',
  })
})
```

### Manual Testing

Test rate limits locally:

```typescript
// Send mutation multiple times
for (let i = 0; i < 15; i++) {
  try {
    await api.messages.send({ content: `Message ${i}` })
    console.log(`✓ Message ${i} sent`)
  } catch (error) {
    console.log(`✗ Rate limit hit at message ${i}`)
    console.log(error.message) // "Too many messages. Please wait a minute..."
  }
}
```

## Error Messages

Rate limit errors are user-friendly and specific:

```typescript
// User sees clear message
throw new Error('Too many messages. Please wait a minute before sending more.')
```

Customize messages in [`rateLimits.ts`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/lib/constants/rateLimits.ts):

```typescript
export const RATE_LIMIT_MESSAGES = {
  SEND_MESSAGE: 'Too many messages. Please wait a minute.',
  UPLOAD_FILE: 'Upload limit reached. Try again in a minute.',
  // ... customize all messages
}
```

## Production Setup

### Enable @convex-dev/rate-limiter Component

Currently, the template uses a placeholder implementation. To enable full rate limiting:

1. **Install the component**:
```bash
npm install @convex-dev/rate-limiter
```

2. **Configure in `convex.config.ts`** (when component is available):
```typescript
import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'

const app = defineApp()
app.use(rateLimiter)
export default app
```

3. **Uncomment production code** in `rateLimitService.ts`:
```typescript
// Remove the placeholder and uncomment the actual implementation
const { rateLimiter } = useComponents()
await rateLimiter.limit(this.ctx, operation, { ... })
```

> **Note**: The component is currently in development. The template is ready to use it once it's publicly available.

## Best Practices

### ✅ Do

- Rate limit all public mutations
- Use stricter limits for expensive operations (email, file uploads)
- Give premium users higher limits
- Use clear, helpful error messages
- Test rate limits in development

### ❌ Don't

- Rate limit read operations (queries) - use caching instead
- Set limits too low (frustrates users)
- Forget to handle rate limit errors in UI
- Hard-code limits in mutations (use centralized config)

## Examples

See practical examples in:

- [`convex/messages.ts`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/messages.ts) - Message rate limiting
- [`convex/files.ts`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/convex/files.ts) - File upload rate limiting
- [`docs/ARCHITECTURE.md`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/docs/ARCHITECTURE.md) - Pattern explanations

## Summary

- ✅ **Convex layer (free)** - User-aware, role-based, transactional
- ⚡ **Cloudflare layer (paid)** - IP-based, DDoS protection
- 🎯 **Two layers** = Infrastructure + business logic protection
- 🔧 **Easy to use** - Simple decorator syntax
- 🧪 **Testable** - Mock implementations included
- 📊 **Configurable** - Centralized limits, role-based multipliers
