# AI & Advanced Integrations Guide

Build AI-powered features with OpenAI, Anthropic, Google AI, and Convex — plus message queues, search, monitoring, and other advanced integrations.

## Overview

Convex makes it easy to build AI features with:

- ✅ **Server-side AI calls** - Keep API keys secure
- ✅ **Streaming responses** - Real-time UI updates
- ✅ **Chat history** - Store conversations in Convex DB
- ✅ **RAG support** - Vector search built-in
- ✅ **Type-safe** - Full TypeScript support

## Quick Start with OpenAI

### 1. Install

```bash
npm install openai
```

### 2. Setup API Key

```bash
# Add to .env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Add to Convex
npx convex env set OPENAI_API_KEY sk-xxxxxxxxxxxxx
```

### 3. Create AI Action

```typescript
// convex/ai.ts
'use node'
import { action } from './_generated/server'
import { v } from 'convex/values'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const chat = action({
  args: {
    message: v.string(),
    conversationId: v.optional(v.id('conversations')),
  },
  handler: async (ctx, args) => {
    // Get conversation history if exists
    const messages = args.conversationId
      ? await ctx.runQuery(api.conversations.getMessages, {
          conversationId: args.conversationId,
        })
      : []

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: args.message },
      ],
    })

    const response = completion.choices[0]?.message?.content ?? ''

    // Store in database
    if (args.conversationId) {
      await ctx.runMutation(api.conversations.addMessage, {
        conversationId: args.conversationId,
        role: 'user',
        content: args.message,
      })
      await ctx.runMutation(api.conversations.addMessage, {
        conversationId: args.conversationId,
        role: 'assistant',
        content: response,
      })
    }

    return { response }
  },
})
```

### 4. Frontend Usage

```typescript
// src/components/ChatBox.tsx
import { useConvexAction } from '@/lib/hooks/useConvexMutation'
import { api } from '@/convex/_generated/api'

export function ChatBox() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  
  const chat = useConvexAction(api.ai.chat)

  const handleSend = async () => {
    const result = await chat.execute({ message })
    setResponse(result.response)
    setMessage('')
  }

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask anything..."
      />
      <button onClick={handleSend} disabled={chat.isLoading}>
        {chat.isLoading ? 'Thinking...' : 'Send'}
      </button>
      {response && <div>{response}</div>}
    </div>
  )
}
```

## Streaming Responses

For real-time streaming:

```typescript
export const chatStreaming = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: args.message }],
      stream: true,
    })

    let fullResponse = ''
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? ''
      fullResponse += content
      // You can emit events here for real-time updates
    }

    return { response: fullResponse }
  },
})
```

## Anthropic (Claude) Integration

### 1. Install

```bash
npm install @anthropic-ai/sdk
```

### 2. Setup

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-xxxxxxxxxxxxx
```

### 3. Usage

```typescript
'use node'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const chatClaude = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: args.message }],
    })

    return { response: message.content[0].text }
  },
})
```

## Other AI Providers

### Google AI (Gemini)

```bash
npm install @google/generative-ai
```

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

const result = await model.generateContent('Hello!')
```

### Replicate

```bash
npm install replicate
```

```typescript
import Replicate from 'replicate'

const replicate = new Replicate()

const output = await replicate.run('stability-ai/sdxl:latest', {
  input: { prompt: 'A sunset' },
})
```

## RAG (Retrieval-Augmented Generation)

Use Convex vector search for RAG:

### 1. Add Embeddings

```typescript
import { action } from './_generated/server'
import { api } from './_generated/api'

export const embedDocument = action({
  args: { documentId: v.id('documents'), content: v.string() },
  handler: async (ctx, args) => {
    // Generate embedding with OpenAI
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: args.content,
    })

    // Store in Convex
    await ctx.runMutation(api.documents.addEmbedding, {
      documentId: args.documentId,
      embedding: embedding.data[0].embedding,
    })
  },
})
```

### 2. Search  and Generate

```typescript
export const ragChat = action({
  args: { question: v.string() },
  handler: async (ctx, args) => {
    // 1. Generate question embedding
    const questionEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: args.question,
    })

    // 2. Search similar documents
    const relevant = await ctx.vectorSearch('documents', 'by_embedding', {
      vector: questionEmbedding.data[0].embedding,
      limit: 3,
    })

    // 3. Build context from results
    const context = relevant.map((doc) => doc.content).join('\n\n')

    // 4. Ask AI with context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Answer based on this context:\n\n${context}`,
        },
        { role: 'user', content: args.question },
      ],
    })

    return { response: completion.choices[0].message.content }
  },
})
```

## Model Comparison

| Model | Provider | Best For | Cost |
|-------|----------|----------|------|
| GPT-4 | OpenAI | Complex reasoning | $$$$ |
| GPT-3.5 Turbo | OpenAI | Fast, cheap tasks | $ |
| Claude 3.5 Sonnet | Anthropic | Long context, coding | $$$ |
| Claude 3 Haiku | Anthropic | Fast, simple tasks | $ |

## Best Practices

- ✅ Store conversations in Convex DB
- ✅ Use rate limiting on AI actions
- ✅ Implement error handling
- ✅ Show loading states in UI
- ✅ Use streaming for better UX
- ✅ Cache common responses
- ❌ Don't expose API keys to frontend
- ❌ Don't send sensitive data to AI

## Cost Management

```typescript
// Track usage
export const recordUsage = internalMutation({
  args: {
    userId: v.string(),
    model: v.string(),
    tokens: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('ai_usage', {
      userId: args.userId,
      model: args.model,
      tokens: args.tokens,
      cost: calculateCost(args.model, args.tokens),
      createdAt: Date.now(),
    })
  },
})
```

## Examples

See also:

- [OpenAI Platform Docs](https://platform.openai.com/docs)
- [Anthropic Docs](https://docs.anthropic.com)
- [Convex Vector Search](https://docs.convex.dev/vector-search)

---

# Advanced Integrations

The sections below cover message queues, search, email, payments, storage, monitoring, and other advanced integrations for the template.

## Message Queues

### Convex Crons (Built-in)

Schedule recurring jobs without external services.

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Every hour
crons.interval('cleanup', { hours: 1 }, internal.tasks.cleanup)

// Every day at midnight
crons.cron('daily-report', '0 0 * * *', internal.reports.generate)

export default crons
```

### Convex Scheduled Functions (Built-in)

Schedule one-off tasks.

```typescript
// convex/tasks.ts
import { mutation, internalMutation } from './_generated/server'
import { internal } from './_generated/api'

export const scheduleReminder = mutation({
  args: { userId: v.id('users'), message: v.string(), delayMs: v.number() },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(args.delayMs, internal.tasks.sendReminder, {
      userId: args.userId,
      message: args.message,
    })
  },
})

export const sendReminder = internalMutation({
  args: { userId: v.id('users'), message: v.string() },
  handler: async (ctx, args) => {
    // Send notification...
  },
})
```

### Cloudflare Queues

Native to Cloudflare Workers.

```jsonc
// wrangler.jsonc
{
  "queues": {
    "producers": [{ "queue": "my-queue", "binding": "MY_QUEUE" }],
    "consumers": [{ "queue": "my-queue" }],
  },
}
```

```typescript
// Worker
export default {
  async fetch(request, env) {
    await env.MY_QUEUE.send({ type: 'task' })
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      console.log(message.body)
      message.ack()
    }
  },
}
```

### RabbitMQ (External)

For complex message routing needs, `npm install amqplib`. RabbitMQ requires a separate server — consider using Convex's built-in scheduling for most use cases.

## Search & Embeddings

### Algolia

```bash
npm install algoliasearch
```

```typescript
import algoliasearch from 'algoliasearch'

const client = algoliasearch('APP_ID', 'API_KEY')
const index = client.initIndex('products')

// Index data
await index.saveObjects([{ objectID: '1', name: 'Product' }])

// Search
const { hits } = await index.search('query')
```

### Typesense

```bash
npm install typesense
```

```typescript
import Typesense from 'typesense'

const client = new Typesense.Client({
  nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
  apiKey: 'xyz',
})

await client.collections('products').documents().search({
  q: 'query',
  query_by: 'name',
})
```

## Email

### Resend

See [EMAIL_WITH_RESEND.md](EMAIL_WITH_RESEND.md) for the full guide.

```bash
npm install resend
```

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'hello@example.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Hello!</p>',
})
```

### React Email

```bash
npm install @react-email/components
```

```tsx
import { Html, Button, Text } from '@react-email/components'

export function WelcomeEmail({ name }) {
  return (
    <Html>
      <Text>Hello {name}!</Text>
      <Button href="https://example.com">Get Started</Button>
    </Html>
  )
}
```

## Payments

### Stripe

See [STRIPE_PAYMENTS.md](STRIPE_PAYMENTS.md) for the full guide.

```bash
npm install stripe
```

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Create checkout session
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  mode: 'subscription',
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
})
```

### Lemon Squeezy

```bash
npm install @lemonsqueezy/lemonsqueezy.js
```

```typescript
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js'

lemonSqueezySetup({ apiKey: process.env.LEMON_SQUEEZY_API_KEY })

const checkout = await createCheckout('store_id', 'variant_id', {
  checkoutData: { email: 'user@example.com' },
})
```

## Storage

### Cloudflare R2 (Configured in Terraform)

See [CLOUDFLARE_FEATURES.md](CLOUDFLARE_FEATURES.md) for R2 setup.

### AWS S3

```bash
npm install @aws-sdk/client-s3
```

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'us-east-1' })

await s3.send(
  new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'file.txt',
    Body: 'content',
  })
)
```

### Uploadthing

```bash
npm install uploadthing
```

Easy file uploads with built-in UI components.

## Monitoring

### Sentry

```bash
npm install @sentry/react
```

```typescript
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  tracesSampleRate: 0.1,
})
```

### LogRocket

```bash
npm install logrocket
```

```typescript
import LogRocket from 'logrocket'

LogRocket.init('org/app')
LogRocket.identify(userId, { name, email })
```

### Highlight.io

```bash
npm install @highlight-run/react
```

Open-source alternative to LogRocket.

## Feature Flags

- **LaunchDarkly**: `npm install launchdarkly-react-client-sdk`
- **PostHog**: `npm install posthog-js` — includes feature flags with analytics
- **Statsig**: `npm install @statsig/react-bindings`

## CMS

- **Sanity**: `npm install next-sanity @sanity/image-url`
- **Payload CMS**: self-hosted, works with any database
- **Contentful**: `npm install contentful`

## Recommended Stack Additions

| Category          | Recommended        | Why                 |
| ----------------- | ------------------ | ------------------- |
| **AI**            | OpenAI / Anthropic | Best models         |
| **Vector Search** | Convex built-in    | No extra service    |
| **Queues**        | Convex Scheduler   | Built-in, free      |
| **Email**         | Resend             | Developer-friendly  |
| **Payments**      | Stripe             | Industry standard   |
| **Monitoring**    | Sentry             | Best error tracking |
| **Analytics**     | PostHog            | Self-hostable       |
