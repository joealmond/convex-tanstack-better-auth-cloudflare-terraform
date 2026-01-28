# Email with Resend Guide

Send transactional emails using Convex and Resend with built-in queuing, retries, and monitoring.

## Why Resend + Convex?

| Feature | Resend via Convex | DIY with nodemailer |
|---------|-------------------|-------------------|
| **Queuing** | ✅ Built-in, durable | ❌ Manual implementation |
| **Retries** | ✅ Automatic on failure | ❌ Manual retry logic |
| **Batching** | ✅ Auto-batches large volumes | ❌ Manual batching |
| **Monitoring** | ✅ Convex dashboard | ❌ Separate monitoring needed |
| **Idempotency** | ✅ Prevents duplicates | ❌ Manual deduplication |
| **Free Tier** | ✅ 3,000 emails/month | ✅ Varies by provider |

## Quick Start

### 1. Install Package

```bash
npm install resend
```

### 2. Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the key

### 3. Add to Environment Variables

Add to `.env` and `.env.local`:

```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Add to Convex environment:

```bash
npx convex env set RESEND_API_KEY re_xxxxxxxxxxxxx
```

## Basic Usage

### Create an Email Action

```typescript
// convex/emails.ts
'use node'
import { action } from './_generated/server'
import { Resend } from 'resend'
import { v } from 'convex/values'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendWelcomeEmail = action({
  args: {
    to: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { data, error } = await resend.emails.send({
      from: 'Your App <noreply@yourapp.com>',
      to: args.to,
      subject: `Welcome, ${args.name}!`,
      html: `
        <h1>Welcome to Our App!</h1>
        <p>Hi ${args.name},</p>
        <p>Thanks for signing up. Get started by exploring your dashboard.</p>
      `,
    })

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return { emailId: data?.id }
  },
})
```

### Call from Mutation

```typescript
// convex/users.ts
import { mutation } from './_generated/server'
import { internal } from './_generated/api'

export const createUser = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert('users', {
      email: args.email,
      name: args.name,
    })

    // Send welcome email asynchronously
    await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
      to: args.email,
      name: args.name,
    })

    return { userId }
  },
})
```

## React Email Integration

Use [React Email](https://react.email) for beautiful, responsive templates.

### 1. Install React Email

```bash
npm install react-email @react-email/components
npm install --save-dev @react-email/render
```

### 2. Create Email Template

```typescript
// emails/WelcomeEmail.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from '@react-email/components'

interface WelcomeEmailProps {
  name: string
  dashboardUrl?: string
}

export function WelcomeEmail({
  name,
  dashboardUrl = 'https://yourapp.com/dashboard',
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f9fc' }}>
        <Container style={{ padding: '40px' }}>
          <Heading>Welcome, {name}!</Heading>
          <Text>Thanks for signing up for our app.</Text>
          <Button
            href={dashboardUrl}
            style={{
              background: '#000',
              color: '#fff',
              padding: '12px 20px',
            }}
          >
            Get Started
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail
```

### 3. Use in Convex Action

```typescript
// convex/emails.ts
'use node'
import { action } from './_generated/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { WelcomeEmail } from '../emails/WelcomeEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendWelcomeEmail = action({
  args: { to: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const html = render(<WelcomeEmail name={args.name} />)

    const { data, error } = await resend.emails.send({
      from: 'Your App <noreply@yourapp.com>',
      to: args.to,
      subject: `Welcome, ${args.name}!`,
      html,
    })

    if (error) throw new Error(`Email failed: ${error.message}`)
    return { emailId: data?.id }
  },
})
```

## Common Email Types

### Password Reset

```typescript
export const sendPasswordReset = action({
  args: { to: v.string(), resetToken: v.string() },
  handler: async (ctx, args) => {
    const resetUrl = `https://yourapp.com/reset-password?token=${args.resetToken}`

    await resend.emails.send({
      from: 'Your App <security@yourapp.com>',
      to: args.to,
      subject: 'Reset Your Password',
      html: `
        <h1>Reset Your Password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    })
  },
})
```

### Notification Email

```typescript
export const sendNotification = action({
  args: {
    to: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await resend.emails.send({
      from: 'Your App <notifications@yourapp.com>',
      to: args.to,
      subject: args.subject,
      html: `<p>${args.message}</p>`,
    })
  },
})
```

## Using Service Adapter Pattern

For better testability and flexibility, use the Service Adapter pattern:

```typescript
// convex/lib/services/emailService.ts
import { Resend } from 'resend'

export interface IEmailService {
  sendWelcome(to: string, name: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
}

export class ResendEmailService implements IEmailService {
  private resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async sendWelcome(to: string, name: string) {
    await this.resend.emails.send({
      from: 'Your App <noreply@yourapp.com>',
      to,
      subject: `Welcome, ${name}!`,
      html: this.renderWelcomeTemplate(name),
    })
  }

  async sendPasswordReset(to: string, token: string) {
    const resetUrl = `https://yourapp.com/reset?token=${token}`
    await this.resend.emails.send({
      from: 'Your App <security@yourapp.com>',
      to,
      subject: 'Reset Your Password',
      html: this.renderResetTemplate(resetUrl),
    })
  }

  private renderWelcomeTemplate(name: string): string {
    return `<h1>Welcome, ${name}!</h1><p>Thanks for joining!</p>`
  }

  private renderResetTemplate(resetUrl: string): string {
    return `<h1>Reset Password</h1><a href="${resetUrl}">Click here</a>`
  }
}

// Mock for testing
export class MockEmailService implements IEmailService {
  public sentEmails: any[] = []

  async sendWelcome(to: string, name: string) {
    this.sentEmails.push({ type: 'welcome', to, name })
  }

  async sendPasswordReset(to: string, token: string) {
    this.sentEmails.push({ type: 'reset', to, token })
  }
}
```

## Domain Setup

### Add Your Domain to Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yourapp.com`)
4. Add the DNS records Resend provides to your DNS provider
5. Wait for verification (usually a few minutes)

### Send from Your Domain

Once verified, update your `from` address:

```typescript
from: 'Your App <hello@yourapp.com>' // Use your domain
```

## Best Practices

### ✅ Do

- Use descriptive `from` names (`'Your App <hello@yourapp.com>'`)
- Include unsubscribe links for marketing emails
- Use React Email for complex templates
- Test emails in development with test addresses
- Handle errors gracefully
- Use rate limiting for email actions

### ❌ Don't

- Send from `@gmail.com` or free providers (will be marked as spam)
- Send marketing emails without consent
- Include sensitive data in email body
- Forget to handle Resend API errors
- Hard-code email content (use templates)

## Error Handling

```typescript
export const sendEmail = action({
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({ /* ... */ })

      if (error) {
        // Log to Convex for monitoring
        console.error('Resend error:', error)
        throw new Error(`Email failed: ${error.message}`)
      }

      return { success: true, emailId: data?.id }
    } catch (err) {
      console.error('Email action failed:', err)
      throw err
    }
  },
})
```

## Monitoring

Check email delivery status in:

1. **Resend Dashboard** - Email status, bounces, complaints
2. **Convex Dashboard** - Action logs, errors, retries

## Testing

### Development Testing

Use Resend's test mode or send to your own email:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development'

const to = isDevelopment ? 'your-test-email@example.com' : args.to
```

### Unit Testing with Mock

```typescript
import { MockEmailService } from '@/convex/lib/services/emailService'

test('sends welcome email', async () => {
  const emailService = new MockEmailService()
  await emailService.sendWelcome('user@test.com', 'Alice')

  expect(emailService.sentEmails).toHaveLength(1)
  expect(emailService.sentEmails[0]).toEqual({
    type: 'welcome',
    to: 'user@test.com',
    name: 'Alice',
  })
})
```

## Pricing

Resend pricing (as of 2026):

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing

Start with free tier and upgrade as needed.

## Summary

- ✅ Install `resend` and get API key
- ✅ Create email actions in Convex
- ✅ Use React Email for templates
- ✅ Call via `ctx.scheduler.runAfter()`
- ✅ Verify your domain for production
- ✅ Use Service Adapter pattern for testability
- ✅ Monitor in Resend dashboard

See [`docs/ARCHITECTURE.md`](file:///Users/mandulaj/dev/source/convex-tanstack-cloudfare/docs/ARCHITECTURE.md) for the Service Adapter pattern details.
