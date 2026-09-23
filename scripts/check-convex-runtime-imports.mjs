import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

export async function checkConvexRuntimeImports(directory = 'convex') {
  const root = resolve(directory)
  const entries = []

  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name === '_generated') continue
      const path = join(folder, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (
        entry.isFile() &&
        /\.(?:ts|tsx|js|jsx)$/.test(entry.name) &&
        (entry.name.match(/\./g) ?? []).length === 1 &&
        entry.name !== 'schema.ts'
      ) {
        entries.push(path)
      }
    }
  }

  await visit(root)
  const groups = { browser: [], node: [] }
  for (const path of entries) {
    const source = await readFile(path, 'utf8')
    const platform = /^\s*['"]use node['"]/m.test(source) ? 'node' : 'browser'
    groups[platform].push(path)
  }

  for (const platform of ['browser', 'node']) {
    if (!groups[platform].length) continue
    await build({
      absWorkingDir: resolve(root, '..'),
      entryPoints: groups[platform],
      bundle: true,
      platform,
      format: 'esm',
      splitting: true,
      outdir: join(root, '.runtime-check'),
      write: false,
      conditions: ['convex', 'module'],
      logLevel: 'silent',
    }).catch((error) => {
      const files = groups[platform].map((path) => relative(root, path)).join(', ')
      throw new Error(`Convex ${platform} import check failed for ${files}: ${error.message}`)
    })
  }
  return { isolate: groups.browser.length, node: groups.node.length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkConvexRuntimeImports(process.argv[2] || 'convex')
  console.log(`Convex imports checked: ${result.isolate} isolate, ${result.node} Node modules`)
}
