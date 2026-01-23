# AI & Advanced Integrations

This document covers AI tooling, message queues, and advanced integrations for the template.

---

## Convex AI Integrations

### Convex AI Chat Component

Official chat component with streaming support.

```bash
npm install @convex-dev/ai-chat
```

```typescript
// convex/ai.ts
import { v } from "convex/values";
import { action } from "./_generated/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chat = action({
  args: {
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: args.messages,
      stream: true,
    });
    
    // Stream response back
    for await (const chunk of completion) {
      // Handle streaming...
    }
  },
});
```

**Environment variable**:
```bash
OPENAI_API_KEY=sk-xxx
```

---

### Convex Vector Search (RAG)

Built-in vector search for AI applications.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
  }),
});

// convex/documents.ts
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    // Generate embedding for query
    const embedding = await generateEmbedding(args.query);
    
    // Search with vector similarity
    return await ctx.db
      .query("documents")
      .withIndex("by_embedding", (q) => 
        q.eq("embedding", embedding)
      )
      .take(10);
  },
});
```

---

## AI Providers

### OpenAI

```bash
npm install openai
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Anthropic (Claude)

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Google AI (Gemini)

```bash
npm install @google/generative-ai
```

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const result = await model.generateContent("Hello!");
```

### Replicate

```bash
npm install replicate
```

```typescript
import Replicate from "replicate";

const replicate = new Replicate();

const output = await replicate.run(
  "stability-ai/sdxl:latest",
  { input: { prompt: "A sunset" } }
);
```

---

## Message Queues

### Convex Crons (Built-in)

Schedule recurring jobs without external services.

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every hour
crons.interval("cleanup", { hours: 1 }, internal.tasks.cleanup);

// Every day at midnight
crons.cron("daily-report", "0 0 * * *", internal.reports.generate);

export default crons;
```

### Convex Scheduled Functions (Built-in)

Schedule one-off tasks.

```typescript
// convex/tasks.ts
import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const scheduleReminder = mutation({
  args: { userId: v.id("users"), message: v.string(), delayMs: v.number() },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(args.delayMs, internal.tasks.sendReminder, {
      userId: args.userId,
      message: args.message,
    });
  },
});

export const sendReminder = internalMutation({
  args: { userId: v.id("users"), message: v.string() },
  handler: async (ctx, args) => {
    // Send notification...
  },
});
```

### RabbitMQ (External)

For complex message routing needs.

```bash
npm install amqplib
```

```typescript
import amqp from "amqplib";

// Publisher
const connection = await amqp.connect(process.env.RABBITMQ_URL);
const channel = await connection.createChannel();

await channel.assertQueue("tasks");
channel.sendToQueue("tasks", Buffer.from(JSON.stringify({ type: "process" })));

// Consumer (in a separate worker)
channel.consume("tasks", (msg) => {
  const task = JSON.parse(msg.content.toString());
  // Process task...
  channel.ack(msg);
});
```

**Note**: RabbitMQ requires a separate server. Consider using Convex's built-in scheduling for most use cases.

### Cloudflare Queues

Native to Cloudflare Workers.

```typescript
// wrangler.jsonc
{
  "queues": {
    "producers": [{ "queue": "my-queue", "binding": "MY_QUEUE" }],
    "consumers": [{ "queue": "my-queue" }]
  }
}
```

```typescript
// Worker
export default {
  async fetch(request, env) {
    await env.MY_QUEUE.send({ type: "task" });
  },
  
  async queue(batch, env) {
    for (const message of batch.messages) {
      console.log(message.body);
      message.ack();
    }
  },
};
```

---

## Search & Embeddings

### Algolia

```bash
npm install algoliasearch
```

```typescript
import algoliasearch from "algoliasearch";

const client = algoliasearch("APP_ID", "API_KEY");
const index = client.initIndex("products");

// Index data
await index.saveObjects([{ objectID: "1", name: "Product" }]);

// Search
const { hits } = await index.search("query");
```

### Typesense

```bash
npm install typesense
```

```typescript
import Typesense from "typesense";

const client = new Typesense.Client({
  nodes: [{ host: "localhost", port: 8108, protocol: "http" }],
  apiKey: "xyz",
});

await client.collections("products").documents().search({
  q: "query",
  query_by: "name",
});
```

---

## Email

### Resend

```bash
npm install resend
```

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<p>Hello!</p>",
});
```

### React Email

```bash
npm install @react-email/components
```

```tsx
import { Html, Button, Text } from "@react-email/components";

export function WelcomeEmail({ name }) {
  return (
    <Html>
      <Text>Hello {name}!</Text>
      <Button href="https://example.com">Get Started</Button>
    </Html>
  );
}
```

---

## Payments

### Stripe

```bash
npm install stripe
```

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: "price_xxx", quantity: 1 }],
  mode: "subscription",
  success_url: "https://example.com/success",
  cancel_url: "https://example.com/cancel",
});
```

### Lemon Squeezy

```bash
npm install @lemonsqueezy/lemonsqueezy.js
```

```typescript
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

lemonSqueezySetup({ apiKey: process.env.LEMON_SQUEEZY_API_KEY });

const checkout = await createCheckout("store_id", "variant_id", {
  checkoutData: { email: "user@example.com" },
});
```

---

## Storage

### Cloudflare R2 (Configured in Terraform)

See [CLOUDFLARE_FEATURES.md](CLOUDFLARE_FEATURES.md) for R2 setup.

### AWS S3

```bash
npm install @aws-sdk/client-s3
```

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });

await s3.send(new PutObjectCommand({
  Bucket: "my-bucket",
  Key: "file.txt",
  Body: "content",
}));
```

### Uploadthing

```bash
npm install uploadthing
```

Easy file uploads with built-in UI components.

---

## Monitoring

### Sentry

```bash
npm install @sentry/react
```

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  tracesSampleRate: 0.1,
});
```

### LogRocket

```bash
npm install logrocket
```

```typescript
import LogRocket from "logrocket";

LogRocket.init("org/app");
LogRocket.identify(userId, { name, email });
```

### Highlight.io

```bash
npm install @highlight-run/react
```

Open-source alternative to LogRocket.

---

## Feature Flags

### LaunchDarkly

```bash
npm install launchdarkly-react-client-sdk
```

### PostHog Feature Flags

```bash
npm install posthog-js
```

PostHog includes feature flags with analytics.

### Statsig

```bash
npm install @statsig/react-bindings
```

---

## CMS

### Sanity

```bash
npm install next-sanity @sanity/image-url
```

### Payload CMS

Self-hosted, works with any database.

### Contentful

```bash
npm install contentful
```

---

## Recommended Stack Additions

| Category | Recommended | Why |
|----------|-------------|-----|
| **AI** | OpenAI / Anthropic | Best models |
| **Vector Search** | Convex built-in | No extra service |
| **Queues** | Convex Scheduler | Built-in, free |
| **Email** | Resend | Developer-friendly |
| **Payments** | Stripe | Industry standard |
| **Monitoring** | Sentry | Best error tracking |
| **Analytics** | PostHog | Self-hostable |
