import { readFile, readdir, rm } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const secretPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live|sk_test|rk_live)_[A-Za-z0-9]{12,}\b/

export async function sanitizeBuildOutput(directory, { checkOnly = false } = {}) {
  const root = resolve(directory)
  const removed = []

  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      if (entry.isSymbolicLink())
        throw new Error(`Build artifact contains a symlink: ${relative(root, path)}`)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) continue

      const name = basename(path)
      const privateFile =
        name === '.env' ||
        name.startsWith('.env.') ||
        name === '.dev.vars' ||
        name.startsWith('.dev.vars.') ||
        (path.startsWith(join(root, 'client') + sep) && name.endsWith('.map'))
      if (privateFile) {
        removed.push(relative(root, path))
        if (!checkOnly) await rm(path)
        continue
      }

      if (/\.(?:js|mjs|cjs|json|html|css|map|txt)$/.test(name)) {
        const source = await readFile(path, 'utf8')
        if (secretPattern.test(source))
          throw new Error(`Build artifact may contain a secret: ${relative(root, path)}`)
      }
    }
  }

  await visit(root)
  if (checkOnly && removed.length)
    throw new Error(`Build artifact contains private files: ${removed.join(', ')}`)
  return removed
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const removed = await sanitizeBuildOutput(process.argv[2] || 'dist', {
    checkOnly: process.argv.includes('--check'),
  })
  console.log(
    `Build artifact checked${removed.length ? `; removed ${removed.length} private file(s)` : ''}`
  )
}
