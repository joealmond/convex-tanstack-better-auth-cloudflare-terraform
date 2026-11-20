#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  authProvider,
  configuredUrl,
  readEnv,
  requireConfiguredEnv,
  workerName,
} from './infra-utils.mjs'

const args = process.argv.slice(2)
const environment = args.includes('--environment')
  ? args[args.indexOf('--environment') + 1]
  : 'preview'
if (!['preview', 'production'].includes(environment)) {
  throw new Error('--environment must be preview or production.')
}

const env = { ...readEnv(), ...process.env }
const selectedAuth = authProvider()
const selectedExamples = JSON.parse(readFileSync('package.json', 'utf8')).convexkit?.examples || []
requireConfiguredEnv(env, ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'])
if (process.env.OTHER_CONVEX_URL && env.VITE_CONVEX_URL === process.env.OTHER_CONVEX_URL) {
  throw new Error(`${environment} must use its own Convex deployment URL.`)
}
if (
  selectedAuth === 'better-auth' &&
  process.env.REQUIRE_LOCAL_SECRET === 'true' &&
  (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.startsWith('your-'))
) {
  throw new Error('BETTER_AUTH_SECRET is missing. Run npm run infra:bootstrap first.')
}
if (process.env.REQUIRE_APP_URL === 'true' || process.env.APP_URL) {
  requireConfiguredEnv(env, ['APP_URL'])
  if (new URL(env.APP_URL).protocol !== 'https:') throw new Error('APP_URL must use HTTPS.')
}
if (env.CLOUDFLARE_WORKER_NAME && !workerName(env.CLOUDFLARE_WORKER_NAME)) {
  throw new Error('CLOUDFLARE_WORKER_NAME is invalid.')
}

function check(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'ignore', shell: false })
  if (result.status !== 0)
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed. Check the selected account and credentials.`
    )
}

function convexEnv(name) {
  const commandArgs = ['convex', 'env', 'get', name]
  if (process.env.CONVEX_URL) commandArgs.push('--url', process.env.CONVEX_URL)
  const result = spawnSync('npx', commandArgs, { encoding: 'utf8', shell: false })
  return result.status === 0 ? result.stdout.trim() : ''
}

function validSender(value) {
  const email = '[^<>\\s@]+@[^<>\\s@]+\\.[^<>\\s@]+'
  return new RegExp(`^(?:${email}|[^<>\\r\\n]{1,80}\\s+<${email}>)$`).test(value)
}

function configuredTransactionalEmail() {
  const key = convexEnv('RESEND_API_KEY')
  const from = convexEnv('RESEND_FROM_EMAIL') || convexEnv('AUTH_EMAIL_FROM')
  if (!key && !from) return
  if (!key || !validSender(from))
    throw new Error(
      'Transactional email is incomplete. Set RESEND_API_KEY and RESEND_FROM_EMAIL or AUTH_EMAIL_FROM in Convex.'
    )
}

check('npx', ['wrangler', 'whoami'])
if (selectedAuth === 'better-auth') {
  const convexArgs = ['convex', 'env', 'get', 'BETTER_AUTH_SECRET']
  if (process.env.CONVEX_URL) convexArgs.push('--url', process.env.CONVEX_URL)
  check('npx', convexArgs)
  const provider = convexEnv('AUTH_EMAIL_PROVIDER') || 'disabled'
  if (!['disabled', 'resend'].includes(provider))
    throw new Error('AUTH_EMAIL_PROVIDER must be disabled or resend. See docs/AUTH_EMAIL.md.')
  if (provider === 'resend') {
    const from = convexEnv('AUTH_EMAIL_FROM')
    const keyPresent = Boolean(convexEnv('RESEND_API_KEY'))
    if (!validSender(from) || !keyPresent)
      throw new Error(
        'Account email is incomplete. Set AUTH_EMAIL_FROM and RESEND_API_KEY in Convex. See docs/AUTH_EMAIL.md.'
      )
  } else if (environment === 'production') {
    throw new Error(
      'Production email/password auth requires AUTH_EMAIL_PROVIDER=resend. See docs/AUTH_EMAIL.md.'
    )
  } else {
    console.warn(
      'Account email is disabled for preview; verification and recovery are unavailable.'
    )
  }
} else if (selectedAuth === 'clerk') {
  if (
    !env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_') ||
    env.CLERK_PUBLISHABLE_KEY.includes('replace_me') ||
    !env.CLERK_SECRET_KEY?.startsWith('sk_') ||
    env.CLERK_SECRET_KEY.includes('replace_me') ||
    !configuredUrl(env.CLERK_JWT_ISSUER_DOMAIN) ||
    new URL(env.CLERK_JWT_ISSUER_DOMAIN).protocol !== 'https:'
  )
    throw new Error(
      'Clerk deploy requires publishable key, secret key, and JWT issuer domain. See docs/CLERK_SETUP.md.'
    )
  const webhookSecret = convexEnv('CLERK_WEBHOOK_SECRET')
  if (!/^whsec_[A-Za-z0-9+/]{20,}={0,2}$/.test(webhookSecret)) {
    if (environment === 'production')
      throw new Error(
        'Set CLERK_WEBHOOK_SECRET on Convex and register the user.deleted webhook before production.'
      )
    console.warn('Clerk account deletion is unavailable until its Convex webhook is configured.')
  }
}
if (selectedExamples.includes('email')) configuredTransactionalEmail()
console.log(`PASS deploy preflight: ${environment}`)
