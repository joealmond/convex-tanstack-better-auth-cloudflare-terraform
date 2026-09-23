#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Use real, isolated installs: symlinking the repository's node_modules hides
// missing dependencies and incompatible provider overlays.
const [auth = 'better-auth', deploy = 'cloudflare', examples = 'none', preset = 'personal'] =
  process.argv.slice(2)
const repository = resolve(import.meta.dirname, '..')
const root = mkdtempSync(join(tmpdir(), 'convexkit-validate-'))
const target = join(root, 'app')
const env = {
  ...process.env,
  CI: 'true',
  VITE_CONVEX_URL: 'https://example.convex.cloud',
  VITE_CONVEX_SITE_URL: 'https://example.convex.site',
  SITE_URL: 'http://localhost:3000',
  VITE_APP_ENV: 'preview',
  VITE_SENTRY_DSN: '',
  CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('example.clerk.accounts.dev$').toString('base64')}`,
  CLERK_SECRET_KEY: 'sk_test_build_only',
  CLERK_JWT_ISSUER_DOMAIN: 'https://example.clerk.accounts.dev',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  WRANGLER_SEND_METRICS: 'false',
}

function run(label, command, args, cwd = target) {
  console.log(`[${preset}/${auth}/${deploy}/${examples}] ${label}`)
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 20 * 1024 * 1024,
  })
  writeFileSync(join(root, `${label}.log`), `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  if (result.status !== 0)
    throw new Error(
      `${label} failed${result.error ? `: ${result.error.message}` : ''}. Inspect ${root}/${label}.log`
    )
}

try {
  run(
    'scaffold',
    process.execPath,
    [
      join(repository, 'packages/create-convexkit/bin/create-convexkit.mjs'),
      target,
      '--yes',
      '--no-install',
      '--template-dir',
      repository,
      '--auth',
      auth,
      '--deploy',
      deploy,
      '--examples',
      examples,
      '--preset',
      preset,
    ],
    repository
  )
  run('install', 'npm', ['install', '--no-fund', '--no-audit'])
  run('routes', 'npm', ['run', 'generate:routes'])
  run('check', 'npm', ['run', 'check'])
  if (process.env.VALIDATE_E2E === 'true') run('e2e-public', 'npm', ['run', 'test:e2e:public'])
  if (process.env.VALIDATE_SKIP_AUDIT !== 'true')
    run('audit', 'npm', ['audit', '--audit-level=low'])
  if (deploy === 'vercel' && !existsSync(join(target, '.vercel/output/config.json'))) {
    throw new Error('Vercel build output is missing')
  }
  if (deploy === 'netlify' && !existsSync(join(target, '.netlify'))) {
    throw new Error('Netlify build output is missing')
  }
  if (deploy === 'cloudflare') {
    run('deploy-config', 'npm', ['run', 'sync:wrangler-config'])
    run('worker-dry-run', 'npx', [
      'wrangler',
      'deploy',
      '--dry-run',
      '--config',
      'dist/server/wrangler.json',
      '--outdir',
      join(root, 'worker'),
    ])
  }
  console.log(`Passed ${preset}/${auth}/${deploy}/${examples}`)
  rmSync(root, { recursive: true, force: true })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
