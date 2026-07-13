#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const yes = process.argv.includes('--yes') || process.argv.includes('-y')
const dryRun = process.argv.includes('--dry-run')
const rl = readline.createInterface({ input: stdin, output: stdout })

function valueFromExample(key) {
  if (!existsSync('.env.example')) return ''
  const line = readFileSync('.env.example', 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${key}=`))
  return line?.slice(key.length + 1) ?? ''
}

async function ask(label, fallback = '') {
  if (yes) return fallback
  const answer = (await rl.question(`${label}${fallback ? ` (${fallback})` : ''}: `)).trim()
  return answer || fallback
}

try {
  const values = {
    CONVEX_DEPLOYMENT: await ask('Convex deployment', valueFromExample('CONVEX_DEPLOYMENT')),
    VITE_CONVEX_URL: await ask('Convex realtime URL', valueFromExample('VITE_CONVEX_URL')),
    VITE_CONVEX_SITE_URL: await ask('Convex site URL', valueFromExample('VITE_CONVEX_SITE_URL')),
    CLERK_PUBLISHABLE_KEY: await ask('Clerk publishable key', 'pk_test_replace_me'),
    CLERK_SECRET_KEY: await ask('Clerk secret key', 'sk_test_replace_me'),
    CLERK_JWT_ISSUER_DOMAIN: await ask(
      'Clerk JWT issuer domain',
      'https://your-clerk-domain.clerk.accounts.dev'
    ),
  }
  const contents = `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\nVITE_APP_ENV=development\nVITE_SENTRY_DSN=\n`
  if (dryRun) console.log(contents)
  else {
    writeFileSync('.env.local', contents)
    console.log('Wrote .env.local')
    console.log('Set CLERK_JWT_ISSUER_DOMAIN in Convex before using authenticated functions.')
  }
} finally {
  rl.close()
}
