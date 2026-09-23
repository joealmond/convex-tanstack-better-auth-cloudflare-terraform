#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'

const environment = process.env.DEPLOY_ENVIRONMENT || 'preview'
let checkoutSha = ''
try {
  checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch {
  // A newly generated local app may not be a Git checkout yet.
}
if (checkoutSha && process.env.DEPLOYED_SHA && checkoutSha !== process.env.DEPLOYED_SHA)
  throw new Error('Release record checkout does not match the deployed commit')
const commit = checkoutSha || process.env.DEPLOYED_SHA || process.env.GITHUB_SHA || 'unversioned'
const workerVersion =
  process.env.WORKER_VERSION_ID ||
  process.env.WRANGLER_OUTPUT?.match(/(?:Current )?Version ID:\s*([^\s]+)/i)?.[1] ||
  'unavailable'
const record = {
  environment,
  deployedAt: new Date().toISOString(),
  commit,
  appUrl: process.env.APP_URL || '',
  convexDeployment: process.env.CONVEX_DEPLOYMENT || '',
  convexUrl: process.env.VITE_CONVEX_URL || '',
  workerName: process.env.CLOUDFLARE_WORKER_NAME || '',
  workerVersion,
  workerBuildIdentity: commit,
  status: process.env.RELEASE_STATUS || 'success',
  smoke: process.env.SMOKE_STATUS || 'success',
}
mkdirSync('.convexkit/releases', { recursive: true, mode: 0o700 })
writeFileSync(
  `.convexkit/releases/${environment}-latest.json`,
  `${JSON.stringify(record, null, 2)}\n`,
  { mode: 0o600 }
)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- Release record: ${JSON.stringify(record)}\n`)
}
console.log(`Wrote .convexkit/releases/${environment}-latest.json`)
