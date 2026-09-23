import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { sanitizeBuildOutput } from './sanitize-build-output.mjs'

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
