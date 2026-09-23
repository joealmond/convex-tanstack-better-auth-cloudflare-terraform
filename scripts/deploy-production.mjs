#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  assertDeployedOrigin,
  authProvider,
  configuredUrl,
  readEnv,
  workerName,
} from './infra-utils.mjs'

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
const selectedAuth = authProvider()
const localPreview = readEnv().VITE_CONVEX_URL
const env = {
  ...process.env,
  REQUIRE_APP_URL: 'true',
  OTHER_CONVEX_URL: process.env.OTHER_CONVEX_URL || localPreview || '',
}
const customDomain = new URL(appUrl).hostname.endsWith('.workers.dev')
  ? ''
  : new URL(appUrl).hostname
const selectedDomain = process.env.CLOUDFLARE_CUSTOM_DOMAIN || customDomain
assertDeployedOrigin(appUrl, {
  name: process.env.CLOUDFLARE_WORKER_NAME,
  routes: selectedDomain ? [{ pattern: selectedDomain, custom_domain: true }] : [],
})
run('node', ['scripts/deploy-preflight.mjs', '--environment', 'production'], env)
run('npx', ['convex', 'env', 'set', 'SITE_URL', appUrl], env)
if (selectedAuth === 'clerk')
  run('npx', ['convex', 'env', 'set', 'CLERK_JWT_ISSUER_DOMAIN', env.CLERK_JWT_ISSUER_DOMAIN], env)
run('npx', ['convex', 'deploy', '--yes'], env)
run('npm', ['run', 'build:prod'], env)
run('npm', ['run', 'sync:wrangler-config'], {
  ...env,
  CLOUDFLARE_CUSTOM_DOMAIN: selectedDomain,
})
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'))
if (config.name !== process.env.CLOUDFLARE_WORKER_NAME) {
  throw new Error('Generated Worker name does not match CLOUDFLARE_WORKER_NAME.')
}
assertDeployedOrigin(appUrl, config)
const output = run('npx', ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json'], env)
if (selectedAuth === 'clerk') {
  const result = spawnSync(
    'npx',
    ['wrangler', 'secret', 'put', 'CLERK_SECRET_KEY', '--config', 'dist/server/wrangler.json'],
    { env, input: env.CLERK_SECRET_KEY, encoding: 'utf8', shell: false }
  )
  if (result.status !== 0) throw new Error('Unable to install the Clerk Worker secret.')
}
assertDeployedOrigin(appUrl, config, output)
const version =
  selectedAuth === 'clerk'
    ? 'unavailable'
    : output.match(/(?:Current )?Version ID:\s*([^\s]+)/i)?.[1] || 'unavailable'
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
