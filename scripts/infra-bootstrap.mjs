#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readEnv, requireConfiguredEnv, updateEnv, workerName } from './infra-utils.mjs'

const args = process.argv.slice(2)
const valueAfter = (flag) => args[args.indexOf(flag) + 1]
const wantsHelp = args.includes('--help') || args.includes('-h')
const withTerraform = args.includes('--with-terraform')

if (wantsHelp) {
  console.log(`Create or reuse the preview backend and verify Cloudflare access.

Usage: npm run infra:bootstrap -- --worker-name my-app-preview [--with-terraform]

--worker-name       Required once; saved locally for repeat runs.
--with-terraform    Apply configured optional Cloudflare resources.
`)
  process.exit(0)
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false, ...options })
  if (result.status !== 0) process.exit(result.status || 1)
}

const statePath = '.convexkit/preview.json'
let state = {}
try {
  state = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(statePath, 'utf8')))
} catch {}

const requestedName = valueAfter('--worker-name') || process.env.CLOUDFLARE_WORKER_NAME || state.workerName
if (!workerName(requestedName || '')) {
  console.error('Choose a unique preview Worker name: npm run infra:bootstrap -- --worker-name my-app-preview')
  process.exit(1)
}

// `convex dev --once` is idempotent after the first interactive project selection.
// It writes the selected development deployment into .env.local.
run('npx', ['convex', 'dev', '--once'])
const env = readEnv()
requireConfiguredEnv(env, ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'])

const secret = env.BETTER_AUTH_SECRET && !env.BETTER_AUTH_SECRET.startsWith('your-')
  ? env.BETTER_AUTH_SECRET
  : randomBytes(32).toString('base64url')
updateEnv('.env.local', { BETTER_AUTH_SECRET: secret, VITE_APP_ENV: 'preview' })
run('npx', ['convex', 'env', 'set', 'BETTER_AUTH_SECRET', secret])
run('npx', ['wrangler', 'whoami'])

if (withTerraform) {
  run('terraform', ['-chdir=infrastructure', 'init'])
  run('terraform', ['-chdir=infrastructure', 'apply', '-auto-approve'])
}

mkdirSync('.convexkit', { recursive: true, mode: 0o700 })
writeFileSync(
  statePath,
  `${JSON.stringify({
    workerName: requestedName,
    convexUrl: env.VITE_CONVEX_URL,
    convexSiteUrl: env.VITE_CONVEX_SITE_URL,
  }, null, 2)}\n`,
  { mode: 0o600 }
)
console.log(`Preview infrastructure is ready for ${requestedName}. Next: npm run deploy:preview`)
