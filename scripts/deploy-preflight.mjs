#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readEnv, requireConfiguredEnv, workerName } from './infra-utils.mjs'

const args = process.argv.slice(2)
const environment = args.includes('--environment') ? args[args.indexOf('--environment') + 1] : 'preview'
if (!['preview', 'production'].includes(environment)) {
  throw new Error('--environment must be preview or production.')
}

const env = { ...readEnv(), ...process.env }
requireConfiguredEnv(env, ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'])
if (process.env.OTHER_CONVEX_URL && env.VITE_CONVEX_URL === process.env.OTHER_CONVEX_URL) {
  throw new Error(`${environment} must use its own Convex deployment URL.`)
}
if (process.env.REQUIRE_LOCAL_SECRET === 'true' && (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.startsWith('your-'))) {
  throw new Error('BETTER_AUTH_SECRET is missing. Run npm run infra:bootstrap first.')
}
if (process.env.APP_URL) requireConfiguredEnv(env, ['APP_URL'])
if (env.CLOUDFLARE_WORKER_NAME && !workerName(env.CLOUDFLARE_WORKER_NAME)) {
  throw new Error('CLOUDFLARE_WORKER_NAME is invalid.')
}

function check(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'ignore', shell: false })
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed. Check the selected account and credentials.`)
}

check('npx', ['wrangler', 'whoami'])
const convexArgs = ['convex', 'env', 'get', 'BETTER_AUTH_SECRET']
if (process.env.CONVEX_URL) convexArgs.push('--url', process.env.CONVEX_URL)
check('npx', convexArgs)
console.log(`PASS deploy preflight: ${environment}`)
