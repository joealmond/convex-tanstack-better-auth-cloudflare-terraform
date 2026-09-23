#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { configuredUrl, readEnv, workerName } from './infra-utils.mjs'

const required = [
  'APP_URL',
  'VITE_CONVEX_URL',
  'VITE_CONVEX_SITE_URL',
  'CONVEX_DEPLOY_KEY',
  'CLOUDFLARE_WORKER_NAME',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
]
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Set production values for ${missing.join(', ')}.`)
if (!configuredUrl(process.env.APP_URL) || new URL(process.env.APP_URL).protocol !== 'https:') {
  throw new Error('APP_URL must be the public HTTPS production origin.')
}
if (!workerName(process.env.CLOUDFLARE_WORKER_NAME)) {
  throw new Error('CLOUDFLARE_WORKER_NAME is invalid.')
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', shell: false })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`)
  return result.stdout || ''
}

const appUrl = process.env.APP_URL
const localPreview = readEnv().VITE_CONVEX_URL
const env = {
  ...process.env,
  REQUIRE_APP_URL: 'true',
  OTHER_CONVEX_URL: process.env.OTHER_CONVEX_URL || localPreview || '',
}
run('node', ['scripts/deploy-preflight.mjs', '--environment', 'production'], env)
run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl], env)
run('npx', ['convex', 'deploy', '--yes'], env)
run('npm', ['run', 'build:prod'], env)
const customDomain = new URL(appUrl).hostname.endsWith('.workers.dev')
  ? ''
  : new URL(appUrl).hostname
run('npm', ['run', 'sync:wrangler-config'], {
  ...env,
  CLOUDFLARE_CUSTOM_DOMAIN: process.env.CLOUDFLARE_CUSTOM_DOMAIN || customDomain,
})
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'))
if (config.name !== process.env.CLOUDFLARE_WORKER_NAME) {
  throw new Error('Generated Worker name does not match CLOUDFLARE_WORKER_NAME.')
}
const output = run('npx', ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json'], env)
const version = output.match(/(?:Current )?Version ID:\s*([^\s]+)/i)?.[1] || 'unavailable'
run(
  'node',
  [
    'scripts/smoke-preview.mjs',
    '--url',
    appUrl,
    '--convex-site-url',
    process.env.VITE_CONVEX_SITE_URL,
  ],
  env
)
run('node', ['scripts/write-release-record.mjs'], {
  ...env,
  DEPLOY_ENVIRONMENT: 'production',
  WORKER_VERSION_ID: version,
})
console.log(`PASS production deployed and verified: ${appUrl}`)
