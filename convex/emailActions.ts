'use node'

import { Resend } from 'resend'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!
  )
}

export const send = internalAction({
  args: {
    deliveryId: v.id('emailDeliveries'),
    ownerId: v.string(),
    to: v.string(),
    name: v.string(),
    kind: v.union(v.literal('welcome'), v.literal('test')),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      await ctx.runMutation(internal.emails.markFailed, {
        deliveryId: args.deliveryId,
        ownerId: args.ownerId,
        error: 'RESEND_API_KEY is not configured on this Convex deployment.',
      })
      return
    }

    try {
      const resend = new Resend(apiKey)
      const name = escapeHtml(args.name || 'there')
      const isWelcome = args.kind === 'welcome'
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'ConvexKit <onboarding@resend.dev>',
        to: args.to,
        subject: isWelcome ? 'Welcome to ConvexKit' : 'Your ConvexKit email integration works',
        html: isWelcome
          ? `<h1>Welcome, ${name}!</h1><p>Your ConvexKit account is ready. Realtime data, auth, and edge deployment are connected.</p>`
          : `<h1>Email delivery works</h1><p>Hi ${name}, this message was queued by a Convex mutation and delivered by a background action.</p>`,
        text: isWelcome
          ? `Welcome, ${args.name || 'there'}! Your ConvexKit account is ready.`
          : `Hi ${args.name || 'there'}, your ConvexKit email integration works.`,
      })
      if (error || !data?.id)
        throw new Error(error?.message || 'Resend did not return a message ID')
      await ctx.runMutation(internal.emails.markSent, {
        deliveryId: args.deliveryId,
        ownerId: args.ownerId,
        providerId: data.id,
      })
    } catch (error) {
      await ctx.runMutation(internal.emails.markFailed, {
        deliveryId: args.deliveryId,
        ownerId: args.ownerId,
        error: error instanceof Error ? error.message : 'Email delivery failed',
      })
    }
  },
})
