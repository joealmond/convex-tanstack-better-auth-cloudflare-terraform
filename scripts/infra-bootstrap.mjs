#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  configuredUrl,
  isConvexCloudPreview,
  readEnv,
  requireConfiguredEnv,
  updateEnv,
  workerName,
} from './infra-utils.mjs'

const args = process.argv.slice(2)
const valueAfter = (flag) => args[args.indexOf(flag) + 1]
const wantsHelp = args.includes('--help') || args.includes('-h')
const withTerraform = args.includes('--with-terraform') || args.includes('--apply-terraform')
const applyTerraform = args.includes('--apply-terraform')

if (wantsHelp) {
  console.log(`Create or reuse the preview backend and verify Cloudflare access.

Usage: npm run infra:bootstrap -- --worker-name my-app-preview --app-url https://my-app.example [--with-terraform]

--worker-name       Required once; saved locally for repeat runs.
--app-url           Required once; exact preview origin used by Better Auth.
--with-terraform    Initialize and show a plan for configured optional resources.
--apply-terraform   Show a plan, then request Terraform's interactive apply confirmation.
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
  state = JSON.parse(
    await import('node:fs/promises').then(({ readFile }) => readFile(statePath, 'utf8'))
  )
} catch {
  // No saved preview state on the first run.
}

const requestedName =
  valueAfter('--worker-name') || process.env.CLOUDFLARE_WORKER_NAME || state.workerName
if (!workerName(requestedName || '')) {
  console.error(
    'Choose a unique preview Worker name: npm run infra:bootstrap -- --worker-name my-app-preview'
  )
  process.exit(1)
}
const appUrl = valueAfter('--app-url') || process.env.APP_URL || state.appUrl
if (!configuredUrl(appUrl || '') || new URL(appUrl).protocol !== 'https:') {
  console.error('Provide the exact HTTPS preview origin: --app-url https://my-app.example')
  process.exit(1)
}

// A configured project can receive its auth origin before any backend push.
// A first-time Convex connection necessarily initializes the selected project,
// then the following push applies the auth origin.
let env = readEnv()
if (isConvexCloudPreview(env)) {
  run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl])
} else {
  run('npx', ['convex', 'dev', '--once'])
  env = readEnv()
}
requireConfiguredEnv(env, ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'])
if (!isConvexCloudPreview(env)) {
  console.error(
    'Preview bootstrap requires a Convex cloud development deployment (dev:..., *.convex.cloud, *.convex.site).'
  )
  process.exit(1)
}

const secret =
  env.BETTER_AUTH_SECRET && !env.BETTER_AUTH_SECRET.startsWith('your-')
    ? env.BETTER_AUTH_SECRET
    : randomBytes(32).toString('base64url')
updateEnv('.env.local', { BETTER_AUTH_SECRET: secret, VITE_APP_ENV: 'preview' })
run('npx', ['convex', 'env', 'set', 'BETTER_AUTH_SECRET'], {
  input: secret,
  stdio: ['pipe', 'inherit', 'inherit'],
})
run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl])
// Push again after setting the auth origin, so the deployable backend reads it.
run('npx', ['convex', 'dev', '--once'])
run('npx', ['wrangler', 'whoami'])

if (withTerraform) {
  run('terraform', ['-chdir=infrastructure', 'init'])
  run('terraform', ['-chdir=infrastructure', 'plan'])
  if (applyTerraform) run('terraform', ['-chdir=infrastructure', 'apply'])
}

mkdirSync('.convexkit', { recursive: true, mode: 0o700 })
writeFileSync(
  statePath,
  `${JSON.stringify(
    {
      workerName: requestedName,
      appUrl,
      convexUrl: env.VITE_CONVEX_URL,
      convexSiteUrl: env.VITE_CONVEX_SITE_URL,
    },
    null,
    2
  )}\n`,
  { mode: 0o600 }
)
console.log(`Preview infrastructure is ready for ${requestedName}. Next: npm run deploy:preview`)
