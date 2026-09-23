import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export function readEnv(path = '.env.local') {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [
          line.slice(0, index).trim(),
          line
            .slice(index + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ]
      })
  )
}

export function updateEnv(path, updates) {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const pending = new Map(Object.entries(updates))
  const lines = existing.split(/\r?\n/).map((line) => {
    const index = line.indexOf('=')
    const key = index === -1 ? '' : line.slice(0, index).trim()
    if (!pending.has(key)) return line
    const value = pending.get(key)
    pending.delete(key)
    return `${key}=${value}`
  })
  for (const [key, value] of pending) lines.push(`${key}=${value}`)
  writeFileSync(
    path,
    `${lines.filter((line, index) => line || index < lines.length - 1).join('\n')}\n`,
    { mode: 0o600 }
  )
}

export function configuredUrl(value) {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.hostname.includes('your-') &&
      !url.hostname.startsWith('example.')
    )
  } catch {
    return false
  }
}

export function workerName(value) {
  return /^[a-z][a-z0-9-]{0,62}$/.test(value)
}

export function requireConfiguredEnv(values, keys) {
  const missing = keys.filter((key) => !configuredUrl(values[key]))
  if (missing.length) throw new Error(`Set valid values for ${missing.join(', ')} in .env.local.`)
}

export function isConvexCloudPreview(values) {
  try {
    const realtime = new URL(values.VITE_CONVEX_URL)
    const site = new URL(values.VITE_CONVEX_SITE_URL)
    return (
      values.CONVEX_DEPLOYMENT?.startsWith('dev:') &&
      realtime.protocol === 'https:' &&
      realtime.hostname.endsWith('.convex.cloud') &&
      site.protocol === 'https:' &&
      site.hostname.endsWith('.convex.site')
    )
  } catch {
    return false
  }
}

export function normalizeUrl(value) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString().replace(/\/$/, '')
}
