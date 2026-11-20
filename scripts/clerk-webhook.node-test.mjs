import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { Buffer } from 'node:buffer'

const { crypto, TextEncoder, Request, ReadableStream } = globalThis

const previous = process.env.CLERK_WEBHOOK_SECRET
const secretBytes = new Uint8Array(32).fill(7)
process.env.CLERK_WEBHOOK_SECRET = `whsec_${Buffer.from(secretBytes).toString('base64')}`
after(() => {
  if (previous === undefined) delete process.env.CLERK_WEBHOOK_SECRET
  else process.env.CLERK_WEBHOOK_SECRET = previous
})
const bundle = await build({
  entryPoints: ['packages/create-convexkit/templates/clerk/convex/clerkWebhook.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [
    {
      name: 'test-boundary',
      setup(builder) {
        builder.onResolve({ filter: /\/_generated\/server$/ }, () => ({
          path: 'server',
          namespace: 'boundary',
        }))
        builder.onResolve({ filter: /\/_generated\/api$/ }, () => ({
          path: 'api',
          namespace: 'boundary',
        }))
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({
          contents:
            path === 'server'
              ? 'export const httpAction = (handler) => handler'
              : 'export const internal = { users: { confirmAccountDeletion: "confirm" } }',
        }))
        builder.onResolve({ filter: /\/lib\/runEffect$/ }, () => ({
          path: resolve('convex/lib/runEffect.ts'),
        }))
      },
    },
  ],
})
const { webhook } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
const key = await crypto.subtle.importKey(
  'raw',
  secretBytes,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
)

async function request(
  body,
  { timestamp = String(Math.floor(Date.now() / 1000)), version = 'v1' } = {}
) {
  const id = 'msg_fixture'
  const signature = Buffer.from(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  ).toString('base64')
  return new Request('https://backend.example/api/clerk/webhook', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `${version},${signature}`,
    },
  })
}

test('valid signed deletion confirms cleanup; retries remain deliverable', async () => {
  const calls = []
  const context = { runMutation: async (...args) => calls.push(args) }
  const body = JSON.stringify({ type: 'user.deleted', data: { id: 'user_owned' } })
  assert.equal((await webhook(context, await request(body))).status, 200)
  assert.equal((await webhook(context, await request(body))).status, 200)
  assert.deepEqual(calls, [
    ['confirm', { userId: 'user_owned' }],
    ['confirm', { userId: 'user_owned' }],
  ])
})

test('rejects tampered, old, unsupported and malformed signed events', async () => {
  let called = false
  const context = {
    runMutation: async () => {
      called = true
    },
  }
  const body = JSON.stringify({ type: 'user.deleted', data: { id: 'user_owned' } })
  const valid = await request(body)
  const tampered = new Request(valid.url, {
    method: 'POST',
    headers: valid.headers,
    body: body.replace('user_owned', 'other'),
  })
  for (const candidate of [
    tampered,
    await request(body, { timestamp: '1' }),
    await request(body, { version: 'v2' }),
    await request('{'),
  ]) {
    assert.equal((await webhook(context, candidate)).status, 400)
  }
  assert.equal(called, false)
})

test('provider-confirmation failure requests a retry without acknowledgement', async () => {
  const context = {
    runMutation: async () => {
      throw new Error('backend unavailable')
    },
  }
  assert.equal(
    (
      await webhook(
        context,
        await request(JSON.stringify({ type: 'user.deleted', data: { id: 'user_owned' } }))
      )
    ).status,
    503
  )
})

test('oversized bodies are canceled before mutation or signature verification', async () => {
  let canceled = false
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_000_001))
    },
    cancel() {
      canceled = true
    },
  })
  const candidate = new Request('https://backend.example/api/clerk/webhook', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  })
  assert.equal((await webhook({}, candidate)).status, 400)
  assert.equal(canceled, true)
})

test('stalled bodies time out and cancel the reader', async () => {
  let canceled = false
  const stream = new ReadableStream({
    cancel() {
      canceled = true
    },
  })
  const candidate = new Request('https://backend.example/api/clerk/webhook', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  })
  assert.equal((await webhook({}, candidate)).status, 503)
  assert.equal(canceled, true)
})
