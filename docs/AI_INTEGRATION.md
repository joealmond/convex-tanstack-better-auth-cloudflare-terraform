# AI Integration Guide

Build AI-powered features with OpenAI, Anthropic, and Convex.

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
