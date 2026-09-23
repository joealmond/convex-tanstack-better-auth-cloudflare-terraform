#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'

const environment = process.env.DEPLOY_ENVIRONMENT || 'preview'
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const record = {
  environment,
  deployedAt: new Date().toISOString(),
  commit,
  appUrl: process.env.APP_URL || '',
  convexDeployment: process.env.CONVEX_DEPLOYMENT || '',
  convexUrl: process.env.VITE_CONVEX_URL || '',
  workerName: process.env.CLOUDFLARE_WORKER_NAME || '',
  workerVersion: process.env.WORKER_VERSION_ID || '',
}
mkdirSync('.convexkit/releases', { recursive: true, mode: 0o700 })
writeFileSync(`.convexkit/releases/${environment}-latest.json`, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- Release record: ${JSON.stringify(record)}\n`)
}
console.log(`Wrote .convexkit/releases/${environment}-latest.json`)
