#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { setTimeout as delay } from 'node:timers/promises'

const repository = resolve(import.meta.dirname, '..')
const root = mkdtempSync(join(tmpdir(), 'convexkit-auth-'))
const target = join(root, 'app')
const children = new Set()
const logs = []
const env = { ...process.env }
// A developer's shell or CI credentials must never select a cloud deployment.
for (const key of Object.keys(env)) {
  if (/^(CONVEX_|VITE_|CLERK_|BETTER_AUTH_|SITE_URL$)/.test(key)) delete env[key]
}
Object.assign(env, {
  CONVEX_AGENT_MODE: 'anonymous',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  WRANGLER_SEND_METRICS: 'false',
})

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

function start(label, command, args, cwd = target, input, overrides = {}) {
  console.log(`[local-auth] ${label}`)
  const log = createWriteStream(join(root, `${label}.log`))
  logs.push(log)
  const child = spawn(command, args, {
    cwd,
    env: { ...env, ...overrides },
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  children.add(child)
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  child.stdin.end(input)
  child.done = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited ${code}; see ${root}/${label}.log`))
    })
  })
  // Long-running servers can exit before the readiness check attaches a handler.
  child.done.catch(() => {})
  return child
}

async function run(...args) {
  const child = start(...args)
  let timer
  try {
    await Promise.race([
      child.done,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Command timed out; inspect ${root}`)), 240_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
    // Convex environment commands can start a backend that outlives the CLI.
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      // The process group has already stopped.
    }
    await delay(500)
  }
}

async function ready(url, child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server stopped; inspect ${root}`)
    try {
      const response = await globalThis.fetch(url, { signal: globalThis.AbortSignal.timeout(2000) })
      if (response.ok) return
    } catch {
      /* Server is still starting. */
    }
    await delay(500)
  }
  throw new Error(`Server did not become ready at ${url}; inspect ${root}`)
}

let passed = false
try {
  const [webPort, cloudPort, sitePort] = await Promise.all([freePort(), freePort(), freePort()])
  const baseUrl = `http://127.0.0.1:${webPort}`
  await run(
    'scaffold',
    process.execPath,
    [
      join(repository, 'packages/create-convexkit/bin/create-convexkit.mjs'),
      target,
      '--yes',
      '--no-install',
      '--template-dir',
      repository,
      '--examples',
      'chat,files',
    ],
    repository
  )
  await run('install', 'npm', ['install', '--no-fund', '--no-audit'])
  await run('init', 'npx', [
    'convex',
    'dev',
    '--once',
    '--skip-push',
    '--local-cloud-port',
    String(cloudPort),
    '--local-site-port',
    String(sitePort),
  ])
  await run('site-url', 'npx', ['convex', 'env', 'set', 'SITE_URL'], target, baseUrl)
  await run(
    'auth-secret',
    'npx',
    ['convex', 'env', 'set', 'BETTER_AUTH_SECRET'],
    target,
    randomBytes(32).toString('hex')
  )
  await run('push', 'npx', ['convex', 'dev', '--once'])
  const backend = start('backend', 'npx', ['convex', 'dev'])
  await ready(`http://127.0.0.1:${cloudPort}/version`, backend)
  const frontend = start('frontend', 'npm', [
    'run',
    'dev:web',
    '--',
    '--host',
    '127.0.0.1',
    '--port',
    String(webPort),
    '--strictPort',
  ])
  await ready(`${baseUrl}/examples/chat`, frontend)
  await run('browser', 'npm', ['run', 'test:e2e:auth'], repository, undefined, {
    E2E_BASE_URL: baseUrl,
    E2E_RUN_AUTH: 'true',
  })
  passed = true
  console.log('[local-auth] Signup, reload, sign-in, chat, upload, and account export passed.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  // Kill only process groups launched by this runner, including their backend children.
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      /* Already exited. */
    }
  }
  await delay(500)
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* Already exited. */
    }
  }
  for (const log of logs) log.end()
  if (passed) rmSync(root, { recursive: true, force: true })
  else console.error(`Validation logs and disposable app retained at ${root}`)
}
