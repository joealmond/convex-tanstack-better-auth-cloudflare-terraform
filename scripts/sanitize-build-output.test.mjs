import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { sanitizeBuildOutput, sanitizeBuildOutputs } from './sanitize-build-output.mjs'

test('removes private build files and rejects leaked credentials', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'convexkit-build-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(root, { recursive: true, force: true })
  )
  await mkdir(join(root, 'client'))
  await writeFile(join(root, 'server.js'), 'export const ok = true')
  await writeFile(join(root, '.dev.vars'), 'SECRET=fixture')
  await writeFile(join(root, 'client', 'app.js.map'), '{}')

  await assert.rejects(sanitizeBuildOutput(root, { checkOnly: true }), /private files/)
  assert.equal((await sanitizeBuildOutput(root)).length, 2)
  assert.equal(await readFile(join(root, 'server.js'), 'utf8'), 'export const ok = true')
  await sanitizeBuildOutput(root, { checkOnly: true })

  await writeFile(join(root, 'server.js'), '-----BEGIN PRIVATE KEY-----')
  await assert.rejects(sanitizeBuildOutput(root), /may contain a secret/)
})

test('checks Netlify function bundles alongside published assets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'convexkit-netlify-build-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(root, { recursive: true, force: true })
  )
  const dist = join(root, 'dist')
  const netlify = join(root, '.netlify')
  await mkdir(dist)
  await mkdir(join(netlify, 'functions-internal'), { recursive: true })
  await writeFile(join(dist, 'index.html'), '<main>ok</main>')
  await writeFile(join(netlify, 'functions-internal', 'server.mjs'), 'export const ok = true')
  await symlink(join(netlify, 'functions-internal', 'server.mjs'), join(netlify, 'server.mjs'))
  await symlink(join(dist, 'index.html'), join(netlify, 'published.html'))

  await sanitizeBuildOutputs([dist, netlify], { checkOnly: true })
  await writeFile(
    join(netlify, 'functions-internal', 'server.mjs'),
    'const key = "sk_live_123456789012"'
  )
  await assert.rejects(sanitizeBuildOutput(netlify, { checkOnly: true }), /may contain a secret/)
})

test('rejects symlinked directories outside deployable roots', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'convexkit-build-link-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(parent, { recursive: true, force: true })
  )
  const root = join(parent, 'dist')
  const outside = join(parent, 'outside')
  await mkdir(root)
  await mkdir(outside)
  await writeFile(join(outside, '.env'), 'PRIVATE=must-not-delete')
  await symlink(outside, join(root, 'outside'))

  await assert.rejects(sanitizeBuildOutput(root), /symlink escapes deployable roots/)
  assert.equal(await readFile(join(outside, '.env'), 'utf8'), 'PRIVATE=must-not-delete')
})

test('skips a contained symlink cycle', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'convexkit-build-cycle-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(root, { recursive: true, force: true })
  )
  await writeFile(join(root, 'server.mjs'), 'export const ok = true')
  await symlink(root, join(root, 'cycle'))

  await sanitizeBuildOutput(root, { checkOnly: true })
})

test('scans linked files using the target name and content', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'convexkit-build-file-link-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(parent, { recursive: true, force: true })
  )
  const dist = join(parent, 'dist')
  const netlify = join(parent, '.netlify')
  await mkdir(dist)
  await mkdir(netlify)
  await writeFile(join(dist, 'secret.js'), 'const key = "sk_live_123456789012"')
  await symlink(join(dist, 'secret.js'), join(netlify, 'server'))

  await assert.rejects(
    sanitizeBuildOutput(netlify, { checkOnly: true, deployableRoots: [dist, netlify] }),
    /may contain a secret/
  )
})

test('recognizes private target names hidden by a symlink alias', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'convexkit-build-private-link-'))
  await t.after(async () =>
    (await import('node:fs/promises')).rm(parent, { recursive: true, force: true })
  )
  const dist = join(parent, 'dist')
  const netlify = join(parent, '.netlify')
  await mkdir(dist)
  await mkdir(netlify)
  await writeFile(join(dist, '.env'), 'PRIVATE=fixture')
  await symlink(join(dist, '.env'), join(netlify, 'runtime'))

  await assert.rejects(
    sanitizeBuildOutput(netlify, { checkOnly: true, deployableRoots: [dist, netlify] }),
    /private files/
  )
})
