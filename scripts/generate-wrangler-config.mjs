import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Auto-load .dev.vars if present (for local deploys)
const devVarsPath = path.join(rootDir, '.dev.vars')
if (existsSync(devVarsPath)) {
  for (const line of readFileSync(devVarsPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

// Vite build generates this config with the resolved entry point and environment
const viteBuildConfig = path.join(rootDir, 'dist', 'server', 'wrangler.json')

if (!existsSync(viteBuildConfig)) {
  console.error('dist/server/wrangler.json not found — run a build first.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(viteBuildConfig, 'utf8'))
const env = config.vars?.APP_ENV || 'preview'

// Write the (possibly unchanged) config back
writeFileSync(viteBuildConfig, JSON.stringify(config, null, 2))
console.log(`Verified dist/server/wrangler.json for ${env} environment`)
