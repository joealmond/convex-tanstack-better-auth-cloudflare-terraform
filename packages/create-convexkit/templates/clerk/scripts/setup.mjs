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
  if (existsSync('.env.local') && !dryRun) {
    const overwrite = await ask('.env.local exists. Overwrite it? [y/N]', 'n')
    if (!['y', 'yes'].includes(overwrite.toLowerCase())) {
      console.log('Setup cancelled without changes.')
      process.exit(0)
    }
  }
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
  if (dryRun) console.log(contents.replace(/^(.*SECRET.*)=(.*)$/gm, '$1=<redacted>'))
  else {
    for (const [key, value] of Object.entries(values)) {
      if (!value || /your-|replace_me/.test(value))
        throw new Error(
          `${key} needs your project value. Configure Convex with npx convex dev --once and copy Clerk keys from the dashboard.`
        )
    }
    writeFileSync('.env.local', contents, { mode: 0o600 })
    console.log('Wrote .env.local')
    console.log('Set CLERK_JWT_ISSUER_DOMAIN in Convex before using authenticated functions.')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  rl.close()
}
