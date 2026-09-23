#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { readEnv } from './infra-utils.mjs'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, ...options })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status !== 0) process.exit(result.status || 1)
  return result.stdout || ''
}

let state = {}
if (existsSync('.convexkit/preview.json')) state = JSON.parse(readFileSync('.convexkit/preview.json', 'utf8'))
const env = readEnv()
const workerName = process.env.CLOUDFLARE_WORKER_NAME || state.workerName
if (!workerName) throw new Error('Run npm run infra:bootstrap -- --worker-name my-app-preview first.')

run('node', ['scripts/deploy-preflight.mjs', '--environment', 'preview'], { stdio: 'pipe', env: { ...process.env, REQUIRE_LOCAL_SECRET: 'true' } })
run('npx', ['convex', 'dev', '--once'], { stdio: 'pipe' })
run('npm', ['run', 'build:preview'], { stdio: 'pipe' })
run('npm', ['run', 'sync:wrangler-config'], {
  stdio: 'pipe',
  env: { ...process.env, CLOUDFLARE_WORKER_NAME: workerName },
})
const output = run('npx', ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json'], { stdio: 'pipe' })
const appUrl = output.match(/https:\/\/[^\s]+\.workers\.dev\b/)?.[0]
if (!appUrl) throw new Error('Wrangler deployed but did not report a workers.dev URL. Set a Custom Domain and run the smoke command with that URL.')

run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl], { stdio: 'pipe' })
run('npx', ['convex', 'dev', '--once'], { stdio: 'pipe' })
run('node', ['scripts/smoke-preview.mjs', '--url', appUrl, '--convex-site-url', env.VITE_CONVEX_SITE_URL], { stdio: 'pipe' })
run('node', ['scripts/write-release-record.mjs'], {
  stdio: 'pipe',
  env: { ...process.env, DEPLOY_ENVIRONMENT: 'preview', APP_URL: appUrl, CLOUDFLARE_WORKER_NAME: workerName, VITE_CONVEX_URL: env.VITE_CONVEX_URL, CONVEX_DEPLOYMENT: env.CONVEX_DEPLOYMENT },
})

state = { ...state, workerName, appUrl }
writeFileSync('.convexkit/preview.json', `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
console.log(`PASS preview deployed and verified: ${appUrl}`)
