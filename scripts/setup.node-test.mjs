import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

test('Better Auth setup sends backend secrets through stdin', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'convexkit-setup-'))
  try {
    const capture = join(cwd, 'commands.jsonl')
    writeFileSync(
      join(cwd, '.env.example'),
      'CONVEX_DEPLOYMENT=dev:test\nVITE_CONVEX_URL=https://test.convex.cloud\nVITE_CONVEX_SITE_URL=https://test.convex.site\nBETTER_AUTH_SECRET=test-secret\nSITE_URL=http://localhost:3000\n'
    )
    const mock = join(cwd, 'npx')
    writeFileSync(
      mock,
      '#!/usr/bin/env node\nimport { appendFileSync } from "node:fs"; const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk); appendFileSync(process.env.CAPTURE_FILE, JSON.stringify({ args: process.argv.slice(2), input: Buffer.concat(chunks).toString() }) + "\\n")\n'
    )
    chmodSync(mock, 0o755)
    const result = spawnSync(process.execPath, [join(repository, 'scripts/setup.mjs'), '--yes'], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${cwd}:${process.env.PATH}`, CAPTURE_FILE: capture },
    })
    assert.equal(result.status, 0, result.stderr)
    const commands = readFileSync(capture, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    const secretSet = commands.find((command) => command.args.at(-1) === 'BETTER_AUTH_SECRET')
    assert.equal(secretSet.input, 'test-secret')
    assert.equal(
      commands.some((command) => command.args.includes('test-secret')),
      false
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
