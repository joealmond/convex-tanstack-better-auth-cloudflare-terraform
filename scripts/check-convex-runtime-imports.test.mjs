import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkConvexRuntimeImports } from './check-convex-runtime-imports.mjs'

test('rejects Node imports in a Convex isolate module', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'convexkit-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const convex = join(root, 'convex')
  await mkdir(convex)
  await writeFile(join(convex, 'safe.ts'), 'export const value = 1')
  await writeFile(
    join(convex, 'node.ts'),
    "'use node'\nimport { readFileSync } from 'node:fs'\nexport const read = readFileSync"
  )
  assert.deepEqual(await checkConvexRuntimeImports(convex), { isolate: 1, node: 1 })

  await writeFile(
    join(convex, 'unsafe.ts'),
    "import { readFileSync } from 'node:fs'\nexport const read = readFileSync"
  )
  await assert.rejects(checkConvexRuntimeImports(convex), /Convex browser import check failed/)
})
