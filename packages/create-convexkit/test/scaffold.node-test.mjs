import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs'
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
    assert.equal(existsSync(join(target, 'worker-configuration.d.ts')), true)
    assert.match(
      readFileSync(join(target, 'public/_headers'), 'utf8'),
      /max-age=31536000, immutable/
    )
    assert.match(
      readFileSync(join(target, 'wrangler.jsonc'), 'utf8'),
      /"main": "\.\/src\/server\.ts"/
    )
    assert.match(readFileSync(join(target, 'wrangler.jsonc'), 'utf8'), /"name": "app-preview"/)
    assert.match(
      readFileSync(join(target, 'README.md'), 'utf8'),
      /--app-url https:\/\/YOUR-PREVIEW-ORIGIN/
    )
    assert.equal(existsSync(join(target, 'infrastructure')), false)
    assert.equal(existsSync(join(target, 'convex/todos.ts')), false)
    assert.doesNotMatch(readFileSync(join(target, 'convex/crons.ts'), 'utf8'), /internal\.files/)
    assert.equal(existsSync(join(target, 'packages/create-convexkit')), false)
    assert.equal(existsSync(join(target, 'ROADMAP.md')), false)
    assert.equal(existsSync(join(target, 'CONTRIBUTING.md')), false)
    assert.match(readFileSync(join(target, 'AGENTS.md'), 'utf8'), /Effect \(required\)/)
    assert.equal(existsSync(join(target, '.github/workflows/ci.yml')), true)
    assert.equal(existsSync(join(target, 'docs/index.md')), false)
    assert.match(readFileSync(join(target, 'docs/README.md'), 'utf8'), /app documentation/)
    assert.equal(existsSync(join(target, 'docs/CONFIGURATION.md')), true)
    assert.equal(existsSync(join(target, 'docs/AUTH_EMAIL.md')), true)
    assert.equal(existsSync(join(target, 'docs/legal-templates/README.md')), true)
    assert.equal(existsSync(join(target, 'docs/legal-templates/public/PRIVACY.hu.md')), true)
    assert.equal(
      existsSync(join(target, 'docs/legal-templates/internal/OPERATOR_RUNBOOK.md')),
      true
    )
    assert.match(readFileSync(join(target, 'docs/README.md'), 'utf8'), /legal-templates/)
    assert.equal(existsSync(join(target, 'src/routes/reset-password.tsx')), true)
    assert.equal(existsSync(join(target, 'src/routes/_authenticated/account.tsx')), true)
    assert.doesNotMatch(
      readFileSync(join(target, 'convex/userExport.ts'), 'utf8'),
      /query\('todos'\)/
    )
    assert.match(readFileSync(join(target, 'src/lib/export-kinds.ts'), 'utf8'), /\['account'\]/)
    const deployWorkflow = readFileSync(join(target, '.github/workflows/deploy.yml'), 'utf8')
    assert.match(deployWorkflow, /Preflight deployment configuration/)
    assert.match(deployWorkflow, /resolve-deploy-target\.mjs/)
    assert.equal(existsSync(join(target, 'scripts/resolve-deploy-target.mjs')), true)
    assert.match(deployWorkflow, /verify-worker-origin\.mjs/)
    assert.equal(existsSync(join(target, 'scripts/verify-worker-origin.mjs')), true)
    assert.ok(
      deployWorkflow.indexOf('Resolve deployment target before any cloud mutation') <
        deployWorkflow.indexOf('Set deployed app URL on Convex')
    )
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies.effect, '3.22.2')
    for (const [, script] of deployWorkflow.matchAll(/npm run ([\w:-]+)/g))
      assert.equal(
        typeof pkg.scripts[script],
        'string',
        `Deploy workflow references missing ${script}`
      )
    assert.match(pkg.scripts.build, /sanitize-build-output/)
    assert.match(pkg.scripts.check, /check:convex-imports/)
    assert.equal(pkg.scripts['docs:build'], undefined)
    assert.equal(typeof pkg.devDependencies.esbuild, 'string')
    assert.equal(existsSync(join(target, 'scripts/sanitize-build-output.mjs')), true)
    assert.equal(existsSync(join(target, 'scripts/check-convex-runtime-imports.mjs')), true)
    assert.equal(existsSync(join(target, 'docs/PROJECT_ACCELERATORS.md')), true)
    assert.deepEqual(pkg.convexkit.examples, [])
    assert.equal(pkg.convexkit.preset, 'personal')
    assert.match(readFileSync(join(target, 'README.md'), 'utf8'), /CONVEX_DEPLOY_KEY_PREVIEW/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('team-saas preset includes organization authorization foundation', () => {
  const { root, target } = scaffold(['--preset', 'team-saas'])
  try {
    assert.equal(existsSync(join(target, 'convex/organizations.ts')), true)
    assert.match(readFileSync(join(target, 'convex/schema.ts'), 'utf8'), /organizationMembers/)
    assert.match(
      readFileSync(join(target, 'convex/_generated/api.d.ts'), 'utf8'),
      /organizations: typeof organizations/
    )
    assert.equal(existsSync(join(target, 'convex/organizations.test.ts')), true)
    assert.match(
      readFileSync(join(target, 'src/lib/export-kinds.ts'), 'utf8'),
      /organizationMembers/
    )
    assert.match(
      readFileSync(join(target, 'docs/CONFIGURATION.md'), 'utf8'),
      /requireOrganizationRole/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('team-saas rejects combinations its schema does not yet compose', () => {
  const root = mkdtempSync(join(tmpdir(), 'convexkit-cli-'))
  try {
    const result = spawnSync(
      process.execPath,
      [
        cli,
        join(root, 'app'),
        '--yes',
        '--no-install',
        '--template-dir',
        repository,
        '--preset',
        'team-saas',
        '--examples',
        'todos',
      ],
      { encoding: 'utf8' }
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /team-saas currently requires --examples none/)
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
    assert.equal(existsSync(join(target, 'worker-configuration.d.ts')), false)
    assert.equal(existsSync(join(target, 'infrastructure')), false)
    assert.equal(existsSync(join(target, 'convex/todos.ts')), true)
    assert.equal(existsSync(join(target, 'convex/stripe.ts')), false)
    assert.doesNotMatch(readFileSync(join(target, 'convex/schema.ts'), 'utf8'), /stripeEvents/)
    assert.match(readFileSync(join(target, 'src/routes/index.tsx'), 'utf8'), /Your realtime app/)
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies.nitro, '3.0.260903-beta')
    assert.match(pkg.scripts.build, /sanitize-build-output\.mjs \.vercel\/output/)
    assert.match(pkg.scripts['build:prod'], /sanitize-build-output\.mjs \.vercel\/output/)
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
    assert.match(
      readFileSync(join(target, 'src/lib/security-headers.ts'), 'utf8'),
      /localBackendUrl\?: string/
    )
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies['@clerk/tanstack-react-start'], '1.5.12')
    assert.equal(pkg.dependencies['@convex-dev/better-auth'], undefined)
    assert.equal(pkg.dependencies.resend, undefined)
    assert.equal(existsSync(join(target, 'convex/authEmails.ts')), false)
    assert.equal(existsSync(join(target, 'src/routes/reset-password.tsx')), false)
    assert.equal(existsSync(join(target, 'src/routes/_authenticated/account.tsx')), true)
    assert.equal(existsSync(join(target, 'convex/userExport.ts')), true)
    assert.equal(existsSync(join(target, 'docs/AUTH_EMAIL.md')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('records local template provenance and emits target-specific checks', () => {
  const { root, target } = scaffold(['--examples', 'none'])
  try {
    const metadata = JSON.parse(readFileSync(join(target, '.convexkit.json'), 'utf8'))
    assert.equal(metadata.templateRef, 'local')
    const cliPackage = JSON.parse(
      readFileSync(join(repository, 'packages/create-convexkit/package.json'), 'utf8')
    )
    const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' })
    assert.equal(help.status, 0)
    assert.match(
      help.stdout,
      new RegExp(`create-convexkit-v${cliPackage.version.replaceAll('.', '\\.')}`)
    )
    assert.equal(metadata.project, undefined)
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
    assert.doesNotMatch(pkg.scripts.check, /test:cli|test:scaffold|test:setup/)
    assert.equal(pkg.scripts['test:guardrails'], undefined)
    assert.equal(existsSync(join(target, '.github/workflows/publish-cli.yml')), false)
    assert.equal(existsSync(join(target, 'convex/seed.ts')), false)
    assert.doesNotMatch(
      readFileSync(join(target, 'convex/_generated/api.d.ts'), 'utf8'),
      /typeof seed/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('local templates exclude secrets, runtime state, and build output', () => {
  const root = mkdtempSync(join(tmpdir(), 'convexkit-isolation-'))
  const source = join(root, 'source')
  const target = join(root, 'app')
  try {
    cpSync(repository, source, {
      recursive: true,
      filter: (path) =>
        ![
          'node_modules',
          '.git',
          '.env.local',
          '.convex',
          '.wrangler',
          '.tanstack',
          'dist',
          'coverage',
          'output',
        ].includes(path.split('/').at(-1)),
    })
    for (const name of [
      '.env',
      '.env.production',
      '.dev.vars',
      'terraform.tfvars',
      'state.tfstate',
    ])
      writeFileSync(join(source, name), 'private-fixture-value')
    const result = spawnSync(
      process.execPath,
      [cli, target, '--yes', '--no-install', '--template-dir', source],
      { encoding: 'utf8' }
    )
    assert.equal(result.status, 0, result.stderr)
    for (const name of [
      '.env',
      '.env.production',
      '.dev.vars',
      'terraform.tfvars',
      'state.tfstate',
    ])
      assert.equal(existsSync(join(target, name)), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('chat-only output omits file links and minimal output retains authentication', () => {
  const chat = scaffold(['--examples', 'chat'])
  const minimal = scaffold(['--examples', 'none'])
  try {
    assert.doesNotMatch(
      readFileSync(join(chat.target, 'src/components/examples/RealtimeChatExample.tsx'), 'utf8'),
      /to="\/files"/
    )
    assert.match(
      readFileSync(join(minimal.target, 'src/routes/index.tsx'), 'utf8'),
      /<AuthControls/
    )
    assert.equal(existsSync(join(minimal.target, 'src/components/AuthControls.tsx')), true)
    const pkg = JSON.parse(readFileSync(join(minimal.target, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies.stripe, undefined)
    assert.equal(pkg.dependencies.resend, undefined)
    assert.equal(existsSync(join(minimal.target, 'convex/authEmails.ts')), true)
    assert.doesNotMatch(
      readFileSync(join(minimal.target, 'src/routes/_authenticated/account.tsx'), 'utf8'),
      /Manage billing/
    )
    assert.equal(pkg.dependencies['@tanstack/react-table'], undefined)
  } finally {
    rmSync(chat.root, { recursive: true, force: true })
    rmSync(minimal.root, { recursive: true, force: true })
  }
})

test('generated account cleanup covers every selected owner-scoped example', () => {
  const { root, target } = scaffold(['--examples', 'todos,ai,email,billing'])
  try {
    const maintenance = readFileSync(join(target, 'convex/maintenance.ts'), 'utf8')
    for (const table of ['todos', 'aiRuns', 'emailDeliveries', 'billingSubscriptions'])
      assert.match(maintenance, new RegExp(`query\\('${table}'\\)`))
    assert.match(maintenance, /billingDeletionTombstones/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('generated file example schedules orphan cleanup', () => {
  const { root, target } = scaffold(['--examples', 'files'])
  try {
    assert.match(
      readFileSync(join(target, 'convex/crons.ts'), 'utf8'),
      /internal\.files\.deleteAbandonedUploads/
    )
    assert.match(
      readFileSync(join(target, 'convex/files.ts'), 'utf8'),
      /export const deleteAbandonedUploads/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
