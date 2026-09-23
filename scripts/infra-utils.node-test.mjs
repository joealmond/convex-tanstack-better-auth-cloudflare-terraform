import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  configuredUrl,
  isConvexCloudPreview,
  verifyDeployment,
  workerName,
} from './infra-utils.mjs'

test('accepts real URLs and rejects starter placeholders', () => {
  assert.equal(configuredUrl('https://preview.convex.cloud'), true)
  assert.equal(configuredUrl('https://your-deployment.convex.cloud'), false)
  assert.equal(configuredUrl('not a URL'), false)
})

test('requires a portable Worker name', () => {
  assert.equal(workerName('my-app-preview'), true)
  assert.equal(workerName('My app'), false)
  assert.equal(workerName('-preview'), false)
})

test('remote smoke checks the app policy and backend health', async () => {
  const urls = []
  const fetcher = async (url) => {
    urls.push(String(url))
    return urls.length === 1
      ? new Response('ok', { headers: { 'content-security-policy': "default-src 'self'" } })
      : Response.json({ status: 'ok', layer: 'convex' })
  }
  await verifyDeployment('https://app.example.com', 'https://backend.convex.site', fetcher)
  assert.deepEqual(urls, ['https://app.example.com', 'https://backend.convex.site/api/health'])
  await assert.rejects(
    verifyDeployment(
      'https://app.example.com',
      'https://backend.convex.site',
      async () => new Response('ok')
    ),
    /content-security-policy/
  )
})

test('rejects a local Convex backend for the cloud preview', () => {
  assert.equal(
    isConvexCloudPreview({
      CONVEX_DEPLOYMENT: 'dev:preview',
      VITE_CONVEX_URL: 'https://preview.convex.cloud',
      VITE_CONVEX_SITE_URL: 'https://preview.convex.site',
    }),
    true
  )
  assert.equal(
    isConvexCloudPreview({
      CONVEX_DEPLOYMENT: 'dev:local',
      VITE_CONVEX_URL: 'http://127.0.0.1:3210',
      VITE_CONVEX_SITE_URL: 'http://127.0.0.1:3211',
    }),
    false
  )
})

test('production deploy stops before cloud commands when credentials are missing', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy-production.mjs'], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Set production values for/)
})

test('release record retains identity and outcome without secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'convexkit-release-'))
  try {
    const result = spawnSync(process.execPath, [resolve('scripts/write-release-record.mjs')], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        GITHUB_SHA: 'commit-fixture',
        APP_URL: 'https://app.example.com',
        DEPLOY_ENVIRONMENT: 'preview',
        RELEASE_STATUS: 'success',
        SMOKE_STATUS: 'success',
        RESEND_API_KEY: 'never-record-this',
      },
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    const contents = readFileSync(
      join(directory, '.convexkit/releases/preview-latest.json'),
      'utf8'
    )
    const record = JSON.parse(contents)
    assert.equal(record.commit, 'commit-fixture')
    assert.equal(record.smoke, 'success')
    assert.doesNotMatch(contents, /never-record-this/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('deploy preflight requires account email only for production Better Auth', () => {
  const directory = mkdtempSync(join(tmpdir(), 'convexkit-preflight-'))
  try {
    const mock = join(directory, 'npx')
    writeFileSync(
      mock,
      '#!/usr/bin/env node\nconst a=process.argv.slice(2); if(a[0]==="wrangler") process.exit(0); const value=process.env[`MOCK_${a[3]}`]; if(value===undefined) process.exit(1); process.stdout.write(value)\n'
    )
    chmodSync(mock, 0o755)
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ convexkit: { auth: 'better-auth' } })
    )
    const baseEnv = {
      PATH: `${directory}:${process.env.PATH}`,
      VITE_CONVEX_URL: 'https://preview.convex.cloud',
      VITE_CONVEX_SITE_URL: 'https://preview.convex.site',
      APP_URL: 'https://app.example.com',
      REQUIRE_APP_URL: 'true',
      MOCK_BETTER_AUTH_SECRET: 'test-secret',
    }
    const run = (environment, extraEnv = {}) =>
      spawnSync(
        process.execPath,
        [resolve('scripts/deploy-preflight.mjs'), '--environment', environment],
        { cwd: directory, env: { ...baseEnv, ...extraEnv }, encoding: 'utf8' }
      )
    const preview = run('preview')
    assert.equal(preview.status, 0, preview.stderr)
    const disabled = run('production')
    assert.notEqual(disabled.status, 0)
    assert.match(disabled.stderr, /AUTH_EMAIL_PROVIDER=resend/)
    const incomplete = run('production', { MOCK_AUTH_EMAIL_PROVIDER: 'resend' })
    assert.notEqual(incomplete.status, 0)
    const ready = run('production', {
      MOCK_AUTH_EMAIL_PROVIDER: 'resend',
      MOCK_AUTH_EMAIL_FROM: 'App <auth@example.com>',
      MOCK_RESEND_API_KEY: 're_test_only',
    })
    assert.equal(ready.status, 0, ready.stderr)
    assert.doesNotMatch(`${ready.stdout}${ready.stderr}`, /re_test_only/)
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ convexkit: { auth: 'clerk' } }))
    const clerkMissing = run('production')
    assert.notEqual(clerkMissing.status, 0)
    const clerkReady = run('production', {
      CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
      CLERK_SECRET_KEY: 'sk_test_fixture',
      CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.com',
    })
    assert.equal(clerkReady.status, 0, clerkReady.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
