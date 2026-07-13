/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.*s')

describe('messages.list', () => {
  it('returns the newest 50 messages in descending order', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      for (let index = 0; index < 55; index += 1) {
        await ctx.db.insert('messages', {
          content: `message-${index}`,
          authorName: 'Test User',
        })
      }
    })

    const messages = await t.query(api.messages.list)

    expect(messages).toHaveLength(50)
    expect(messages[0]?.content).toBe('message-54')
    expect(messages.at(-1)?.content).toBe('message-5')
  })
})
