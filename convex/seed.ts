/**
 * Seed Script
 * ===========
 *
 * Populate your Convex database with example data for development.
 *
 * ## How to Run
 *
 * From the Convex Dashboard:
 * 1. Go to your project → Functions
 * 2. Run `seed.run` with no arguments
 *
 * Or via CLI:
 * ```bash
 * npx convex run seed:run
 * ```
 *
 * ## Notes
 * - Only runs if the messages table is empty (safe to run multiple times)
 * - Creates sample messages for the demo chat
 * - Does NOT create users — users are managed by Better Auth
 */

import { internalMutation } from './lib/customFunctions'

const SAMPLE_MESSAGES = [
  {
    content: 'Welcome to the Convex + TanStack + Cloudflare template! 🚀',
    authorName: 'Template Bot',
  },
  {
    content: 'This is a real-time message board powered by Convex.',
    authorName: 'Template Bot',
  },
  {
    content: 'Try signing in with Google to send your own messages.',
    authorName: 'Template Bot',
  },
  {
    content: 'Check out docs/RBAC.md to learn how to become an admin!',
    authorName: 'Template Bot',
  },
  {
    content: 'File uploads work too — click "Files" in the header.',
    authorName: 'Template Bot',
  },
]

/**
 * Seed the database with sample data.
 * Safe to call multiple times — only seeds if tables are empty.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if messages already exist
    const existingMessages = await ctx.db.query('messages').take(1)
    if (existingMessages.length > 0) {
      console.log('Database already has messages — skipping seed.')
      return { seeded: false, reason: 'Data already exists' }
    }

    // Insert sample messages
    for (let i = 0; i < SAMPLE_MESSAGES.length; i++) {
      const msg = SAMPLE_MESSAGES[i]!
      await ctx.db.insert('messages', {
        content: msg.content,
        authorName: msg.authorName,
      })
    }

    console.log(`Seeded ${SAMPLE_MESSAGES.length} sample messages.`)
    return { seeded: true, count: SAMPLE_MESSAGES.length }
  },
})
