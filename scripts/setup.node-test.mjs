import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const repository = resolve(import.meta.dirname, '..')
for (const script of [
  'scripts/setup.mjs',
  'packages/create-convexkit/templates/clerk/scripts/setup.mjs',
]) {
  test(`${script} preserves existing settings without explicit overwrite`, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'convexkit-setup-'))
    try {
      const original =
        'CUSTOM_SETTING=preserve-me\nBETTER_AUTH_SECRET=private-existing-secret\nCLERK_SECRET_KEY=private-clerk-secret\n'
      writeFileSync(join(cwd, '.env.local'), original)
      const result = spawnSync(process.execPath, [join(repository, script), '--yes'], {
        cwd,
        encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(readFileSync(join(cwd, '.env.local'), 'utf8'), original)
      const preview = spawnSync(
        process.execPath,
        [join(repository, script), '--dry-run', '--yes'],
        { cwd, encoding: 'utf8' }
      )
      assert.equal(preview.status, 0, preview.stderr)
      assert.doesNotMatch(preview.stdout, /private-existing-secret|private-clerk-secret/)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
  test(`${script} rejects placeholder configuration instead of claiming setup succeeded`, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'convexkit-setup-'))
    try {
      copyFileSync(join(repository, '.env.example'), join(cwd, '.env.example'))
      const result = spawnSync(process.execPath, [join(repository, script), '--yes'], {
        cwd,
        encoding: 'utf8',
      })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /placeholder|project value/)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
}
