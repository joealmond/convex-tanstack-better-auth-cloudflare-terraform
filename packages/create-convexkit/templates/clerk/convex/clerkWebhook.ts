import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { Effect } from 'effect'
import { runEffect } from './lib/runEffect'

class BodyTimeout extends Error {}

function readBody(request: Request) {
  return runEffect(
    Effect.tryPromise({
      try: async (signal) => {
        const reader = request.body?.getReader()
        if (!reader) return ''
        const cancel = () => void reader.cancel().catch(() => {})
        signal.addEventListener('abort', cancel, { once: true })
        const decoder = new TextDecoder()
        let body = ''
        let size = 0
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) return body + decoder.decode()
            size += value.byteLength
            if (size > 1_000_000) throw new Error('Webhook body too large')
            body += decoder.decode(value, { stream: true })
          }
        } finally {
          signal.removeEventListener('abort', cancel)
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
      },
      catch: (error) => error,
    }).pipe(
      Effect.timeoutFail({
        duration: 10_000,
        onTimeout: () => new BodyTimeout('Webhook body timed out'),
      })
    )
  )
}

function bytes(value: string) {
  return Uint8Array.from(atob(value.replace(/^whsec_/, '')), (char) => char.charCodeAt(0))
}

async function verified(request: Request, body: string) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')
  if (!secret || !id || !timestamp || !signature) return false
  if (!Number.isFinite(Number(timestamp)) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return false
  const key = await crypto.subtle.importKey(
    'raw',
    bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  for (const entry of signature.split(' ')) {
    const [version, value] = entry.split(',')
    if (version === 'v1' && value && (await crypto.subtle.verify('HMAC', key, bytes(value), data)))
      return true
  }
  return false
}

export const webhook = httpAction(async (ctx, request) => {
  let event: { type?: unknown; data?: { id?: unknown } }
  try {
    const body = await readBody(request)
    if (!(await verified(request, body)))
      return new Response('Invalid Clerk webhook', { status: 400 })
    event = JSON.parse(body)
  } catch (error) {
    if (error instanceof BodyTimeout) return new Response('Webhook body timed out', { status: 503 })
    return new Response('Invalid Clerk webhook', { status: 400 })
  }
  if (event?.type !== 'user.deleted') return Response.json({ received: true })
  if (typeof event.data?.id !== 'string' || !event.data.id)
    return new Response('Missing Clerk user ID', { status: 400 })
  try {
    await ctx.runMutation(internal.users.confirmAccountDeletion, { userId: event.data.id })
    return Response.json({ received: true })
  } catch {
    return new Response('Deletion confirmation unavailable', { status: 503 })
  }
})
