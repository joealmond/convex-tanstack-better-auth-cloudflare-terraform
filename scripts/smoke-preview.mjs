#!/usr/bin/env node
import { configuredUrl } from './infra-utils.mjs'

const args = process.argv.slice(2)
const get = (flag) => args[args.indexOf(flag) + 1]
const appUrl = get('--url')
const convexSiteUrl = get('--convex-site-url')

if (!configuredUrl(appUrl) || !configuredUrl(convexSiteUrl)) {
  throw new Error('Usage: node scripts/smoke-preview.mjs --url https://app.example --convex-site-url https://app.convex.site')
}

const app = await fetch(appUrl, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
if (!app.ok) throw new Error(`App smoke failed: ${app.status} ${app.statusText}`)
if (!app.headers.get('content-security-policy')?.includes("default-src 'self'")) {
  throw new Error('App smoke failed: missing content-security-policy.')
}

const health = await fetch(new URL('/api/health', convexSiteUrl), { signal: AbortSignal.timeout(15_000) })
if (!health.ok) throw new Error(`Convex health failed: ${health.status} ${health.statusText}`)
const payload = await health.json()
if (payload.status !== 'ok' || payload.layer !== 'convex') throw new Error('Convex health returned an unexpected response.')

console.log(`PASS read-only smoke: ${appUrl}`)
