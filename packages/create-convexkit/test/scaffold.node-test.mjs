import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repository = resolve('.')
const cli = join(repository, 'packages/create-convexkit/bin/create-convexkit.mjs')

function scaffold(args) {
  const root = mkdtempSync(join(tmpdir(), 'convexkit-cli-'))
  const target = join(root, 'app')
  const result = spawnSync(
    process.execPath,
    [cli, target, '--yes', '--no-install', '--template-dir', repository, ...args],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return { root, target }
}

test('creates the default Better Auth + Cloudflare application', () => {
  const { root, target } = scaffold([])
  try {
    assert.equal(existsSync(join(target, 'wrangler.jsonc')), true)
    assert.equal(existsSync(join(target, 'infrastructure')), false)
    assert.equal(existsSync(join(target, 'convex/todos.ts')), true)
    assert.equal(existsSync(join(target, 'packages/create-convexkit')), false)
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.deepEqual(pkg.convexkit.examples, [
      'chat',
      'files',
      'admin',
      'forms',
      'todos',
      'ai',
      'billing',
      'email',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('composes only selected examples for Vercel', () => {
  const { root, target } = scaffold([
    '--deploy',
    'vercel',
    '--examples',
    'forms,todos',
    '--terraform',
  ])
  try {
    assert.equal(existsSync(join(target, 'vercel.json')), true)
    assert.equal(existsSync(join(target, 'wrangler.jsonc')), false)
    assert.equal(existsSync(join(target, 'infrastructure')), false)
    assert.equal(existsSync(join(target, 'convex/todos.ts')), true)
    assert.equal(existsSync(join(target, 'convex/stripe.ts')), false)
    assert.doesNotMatch(readFileSync(join(target, 'convex/schema.ts'), 'utf8'), /stripeEvents/)
    assert.match(readFileSync(join(target, 'src/routes/index.tsx'), 'utf8'), /Your realtime app/)
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies.nitro, '3.0.260610-beta')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('applies Clerk and Netlify provider overlays', () => {
  const { root, target } = scaffold([
    '--auth',
    'clerk',
    '--deploy',
    'netlify',
    '--examples',
    'chat,forms',
  ])
  try {
    assert.equal(existsSync(join(target, 'netlify.toml')), true)
    assert.equal(existsSync(join(target, 'src/lib/auth-client.ts')), false)
    assert.equal(existsSync(join(target, 'convex/auth.ts')), false)
    assert.match(readFileSync(join(target, 'src/routes/__root.tsx'), 'utf8'), /ClerkProvider/)
    assert.match(readFileSync(join(target, 'convex/lib/authHelpers.ts'), 'utf8'), /getUserIdentity/)
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies['@clerk/tanstack-react-start'], '^1.4.17')
    assert.equal(pkg.dependencies['@convex-dev/better-auth'], undefined)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
