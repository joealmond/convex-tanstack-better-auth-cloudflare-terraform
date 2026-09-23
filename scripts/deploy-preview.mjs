#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { configuredUrl, isConvexCloudPreview, normalizeUrl, readEnv } from './infra-utils.mjs'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, ...options })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status !== 0) process.exit(result.status || 1)
  return result.stdout || ''
}

let state = {}
if (existsSync('.convexkit/preview.json'))
  state = JSON.parse(readFileSync('.convexkit/preview.json', 'utf8'))
const env = readEnv()
const workerName = process.env.CLOUDFLARE_WORKER_NAME || state.workerName
if (!workerName)
  throw new Error('Run npm run infra:bootstrap -- --worker-name my-app-preview first.')
const appUrl = process.env.APP_URL || state.appUrl
if (!configuredUrl(appUrl || '') || new URL(appUrl).protocol !== 'https:') {
  throw new Error('Run bootstrap with --app-url https://your-preview-origin first.')
}
if (!isConvexCloudPreview(env)) {
  throw new Error(
    'Preview deploy requires a Convex cloud development deployment, not a local backend.'
  )
}

run('node', ['scripts/deploy-preflight.mjs', '--environment', 'preview'], {
  stdio: 'pipe',
  env: { ...process.env, APP_URL: appUrl, REQUIRE_APP_URL: 'true', REQUIRE_LOCAL_SECRET: 'true' },
})
// The bootstrap stores SITE_URL before this push. Repeat it here to make a
// deploy resilient to a manually changed Convex environment.
run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl], { stdio: 'pipe' })
run('npx', ['convex', 'dev', '--once'], { stdio: 'pipe' })
run('npm', ['run', 'build:preview'], { stdio: 'pipe' })
run('npm', ['run', 'sync:wrangler-config'], {
  stdio: 'pipe',
  env: {
    ...process.env,
    CLOUDFLARE_WORKER_NAME: workerName,
    CLOUDFLARE_CUSTOM_DOMAIN:
      process.env.CLOUDFLARE_CUSTOM_DOMAIN ||
      (new URL(appUrl).hostname.endsWith('.workers.dev') ? '' : new URL(appUrl).hostname),
  },
})
const output = run('npx', ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json'], {
  stdio: 'pipe',
})
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'))
const configuredDomain = config.routes?.find((route) => route.custom_domain)?.pattern
if (configuredDomain && new URL(appUrl).hostname !== configuredDomain) {
  throw new Error(`APP_URL must match the deployed Custom Domain: https://${configuredDomain}`)
}
const workersUrl = output.match(/https:\/\/[^\s]+\.workers\.dev\b/)?.[0]
if (!configuredDomain && workersUrl && normalizeUrl(appUrl) !== normalizeUrl(workersUrl)) {
  throw new Error(`APP_URL does not match Wrangler's deployed URL: ${workersUrl}`)
}
if (!configuredDomain && !workersUrl) {
  throw new Error(
    'Wrangler did not report a workers.dev URL. Configure a Custom Domain or retry the deployment.'
  )
}
const workerVersion = output.match(/(?:Current )?Version ID:\s*([^\s]+)/i)?.[1] || 'unavailable'

run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl], { stdio: 'pipe' })
run('npx', ['convex', 'dev', '--once'], { stdio: 'pipe' })
run(
  'node',
  ['scripts/smoke-preview.mjs', '--url', appUrl, '--convex-site-url', env.VITE_CONVEX_SITE_URL],
  { stdio: 'pipe' }
)
run('node', ['scripts/write-release-record.mjs'], {
  stdio: 'pipe',
  env: {
    ...process.env,
    DEPLOY_ENVIRONMENT: 'preview',
    APP_URL: appUrl,
    CLOUDFLARE_WORKER_NAME: workerName,
    WORKER_VERSION_ID: workerVersion,
    VITE_CONVEX_URL: env.VITE_CONVEX_URL,
    CONVEX_DEPLOYMENT: env.CONVEX_DEPLOYMENT,
  },
})

state = { ...state, workerName, appUrl }
writeFileSync('.convexkit/preview.json', `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
console.log(`PASS preview deployed and verified: ${appUrl}`)
