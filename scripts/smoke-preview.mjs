#!/usr/bin/env node
import { configuredUrl, verifyDeployment } from './infra-utils.mjs'

const args = process.argv.slice(2)
const get = (flag) => args[args.indexOf(flag) + 1]
const appUrl = get('--url')
const convexSiteUrl = get('--convex-site-url')

if (!configuredUrl(appUrl) || !configuredUrl(convexSiteUrl)) {
  throw new Error(
    'Usage: node scripts/smoke-preview.mjs --url https://app.example --convex-site-url https://app.convex.site'
  )
}

await verifyDeployment(appUrl, convexSiteUrl)

console.log(`PASS read-only smoke: ${appUrl}`)
