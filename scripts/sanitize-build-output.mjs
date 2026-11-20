import { readFile, readdir, realpath, rm, stat } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const secretPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live|sk_test|rk_live)_[A-Za-z0-9]{12,}\b/

function inside(root, path) {
  return path === root || path.startsWith(root + sep)
}

export async function sanitizeBuildOutput(
  directory,
  { checkOnly = false, deployableRoots = [directory] } = {}
) {
  const root = resolve(directory)
  const allowedRoots = await Promise.all(deployableRoots.map((path) => realpath(resolve(path))))
  const removed = []
  const visited = new Set()

  async function visit(folder) {
    const realFolder = await realpath(folder)
    if (!allowedRoots.some((allowedRoot) => inside(allowedRoot, realFolder)))
      throw new Error(`Build artifact path escapes deployable roots: ${relative(root, folder)}`)
    if (visited.has(realFolder)) return
    visited.add(realFolder)
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      let target = path
      let file = entry.isFile()
      // Nitro uses symlinks for some provider bundles. Scan the linked file instead
      // of rejecting a deployable artifact solely because its layout is symlinked.
      if (entry.isSymbolicLink()) {
        target = await realpath(path)
        if (!allowedRoots.some((allowedRoot) => inside(allowedRoot, target)))
          throw new Error(
            `Build artifact symlink escapes deployable roots: ${relative(root, path)}`
          )
        const targetInfo = await stat(path)
        if (targetInfo.isDirectory()) {
          await visit(path)
          continue
        }
        file = targetInfo.isFile()
      }
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!file) continue

      const names = [basename(path), basename(target)]
      const privateFile =
        names.some(
          (name) =>
            name === '.env' ||
            name.startsWith('.env.') ||
            name === '.dev.vars' ||
            name.startsWith('.dev.vars.')
        ) ||
        ([path, target].some((candidate) => inside(join(root, 'client'), candidate)) &&
          names.some((name) => name.endsWith('.map')))
      if (privateFile) {
        removed.push(relative(root, path))
        if (!checkOnly) await rm(path)
        continue
      }

      if (names.some((name) => /\.(?:js|mjs|cjs|json|html|css|map|txt)$/.test(name))) {
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

export async function sanitizeBuildOutputs(directories, options) {
  const results = []
  for (const directory of directories)
    results.push(await sanitizeBuildOutput(directory, { ...options, deployableRoots: directories }))
  return results
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arguments_ = process.argv.slice(2)
  const directories = arguments_.filter((argument) => argument !== '--check')
  const removed = (
    await sanitizeBuildOutputs(directories.length ? directories : ['dist'], {
      checkOnly: arguments_.includes('--check'),
    })
  ).flat()
  console.log(
    `Build artifact checked${removed.length ? `; removed ${removed.length} private file(s)` : ''}`
  )
}
