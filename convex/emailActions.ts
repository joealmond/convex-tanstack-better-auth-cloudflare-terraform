import { v } from 'convex/values'
import { Effect, Schedule } from 'effect'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { runEffect } from './lib/runEffect'

const SEND_TIMEOUT_MS = 10_000
const retrySchedule = Schedule.intersect(Schedule.exponential('500 millis'), Schedule.recurs(2))

class DeliveryError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly code: string
  ) {
    super(message)
  }
}

function retryable(error: DeliveryError) {
  return (
    error.statusCode === null ||
    error.statusCode === 408 ||
    error.statusCode === 429 ||
    (error.statusCode !== null && error.statusCode >= 500) ||
    error.code === 'concurrent_idempotent_requests'
  )
}

function uncertain(error: DeliveryError) {
  return (
    error.statusCode === null ||
    error.statusCode === 408 ||
    (error.statusCode !== null && error.statusCode >= 500) ||
    error.code === 'concurrent_idempotent_requests'
  )
}

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

    let providerId: string
    try {
      const name = escapeHtml(args.name || 'there')
      const isWelcome = args.kind === 'welcome'
      const payload = {
        from: process.env.RESEND_FROM_EMAIL || 'ConvexKit <onboarding@resend.dev>',
        to: args.to,
        subject: isWelcome ? 'Welcome to ConvexKit' : 'Your ConvexKit email integration works',
        html: isWelcome
          ? `<h1>Welcome, ${name}!</h1><p>Your ConvexKit account is ready. Realtime data, auth, and edge deployment are connected.</p>`
          : `<h1>Email delivery works</h1><p>Hi ${name}, this message was queued by a Convex mutation and delivered by a background action.</p>`,
        text: isWelcome
          ? `Welcome, ${args.name || 'there'}! Your ConvexKit account is ready.`
          : `Hi ${args.name || 'there'}, your ConvexKit email integration works.`,
      }
      const idempotencyKey = `convexkit/email-delivery/${args.deliveryId}`
      providerId = await runEffect(
        Effect.tryPromise({
          try: async (signal) => {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
              },
              body: JSON.stringify(payload),
              signal,
            })
            const result: unknown = await response.json().catch(() => null)
            if (!response.ok) {
              const details = result && typeof result === 'object' ? result : {}
              const code =
                'name' in details && typeof details.name === 'string'
                  ? details.name
                  : 'provider_error'
              const message =
                'message' in details && typeof details.message === 'string'
                  ? details.message
                  : `Resend request failed with status ${response.status}`
              throw new DeliveryError(message, response.status, code)
            }
            if (
              !result ||
              typeof result !== 'object' ||
              !('id' in result) ||
              typeof result.id !== 'string'
            ) {
              throw new DeliveryError(
                'Resend did not return a message ID',
                null,
                'invalid_response'
              )
            }
            return result.id
          },
          catch: (error) =>
            error instanceof DeliveryError
              ? error
              : new DeliveryError('Resend delivery result is unknown', null, 'transport_error'),
        }).pipe(
          Effect.timeoutFail({
            duration: SEND_TIMEOUT_MS,
            onTimeout: () => new DeliveryError('Resend delivery timed out', null, 'timeout'),
          }),
          Effect.retry({ schedule: retrySchedule, while: retryable })
        )
      )
    } catch (error) {
      if (error instanceof DeliveryError && uncertain(error)) {
        await ctx.runMutation(internal.emails.markUnknown, {
          deliveryId: args.deliveryId,
          ownerId: args.ownerId,
        })
      } else {
        await ctx.runMutation(internal.emails.markFailed, {
          deliveryId: args.deliveryId,
          ownerId: args.ownerId,
          error: error instanceof Error ? error.message : 'Email delivery failed',
        })
      }
      return
    }
    try {
      await ctx.runMutation(internal.emails.markSent, {
        deliveryId: args.deliveryId,
        ownerId: args.ownerId,
        providerId,
      })
    } catch {
      // Provider accepted the email; a failed status write cannot mean delivery failed.
      await ctx.runMutation(internal.emails.markUnknown, {
        deliveryId: args.deliveryId,
        ownerId: args.ownerId,
      })
    }
  },
})
