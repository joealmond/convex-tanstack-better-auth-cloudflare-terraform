#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
import { configuredUrl, workerName } from './infra-utils.mjs'

const environment = process.env.ENVIRONMENT
if (!['preview', 'production'].includes(environment))
  throw new Error('ENVIRONMENT must be preview or production')
const suffix = environment === 'production' ? 'PROD' : 'PREVIEW'
const otherSuffix = environment === 'production' ? 'PREVIEW' : 'PROD'
const selected = (key) => process.env[`${key}_${suffix}`]?.trim() || ''
const other = (key) => process.env[`${key}_${otherSuffix}`]?.trim() || ''
const values = {
  APP_URL: selected('APP_URL'),
  CLOUDFLARE_WORKER_NAME: selected('CLOUDFLARE_WORKER_NAME'),
  CLOUDFLARE_CUSTOM_DOMAIN: selected('CLOUDFLARE_CUSTOM_DOMAIN'),
  VITE_CONVEX_URL: selected('VITE_CONVEX_URL'),
  VITE_CONVEX_SITE_URL: selected('VITE_CONVEX_SITE_URL'),
  CONVEX_DEPLOY_KEY: selected('CONVEX_DEPLOY_KEY'),
  CONVEX_URL: selected('CONVEX_URL'),
  CONVEX_ADMIN_KEY: selected('CONVEX_ADMIN_KEY'),
  CONVEX_DEPLOYMENT: selected('CONVEX_DEPLOYMENT'),
  OTHER_CONVEX_URL: other('VITE_CONVEX_URL'),
}
if (!configuredUrl(values.APP_URL) || new URL(values.APP_URL).protocol !== 'https:')
  throw new Error(`${suffix} APP_URL is missing or invalid`)
if (!workerName(values.CLOUDFLARE_WORKER_NAME))
  throw new Error(`${suffix} CLOUDFLARE_WORKER_NAME is missing or invalid`)
const hostname = new URL(values.APP_URL).hostname
if (values.CLOUDFLARE_CUSTOM_DOMAIN) {
  if (hostname !== values.CLOUDFLARE_CUSTOM_DOMAIN)
    throw new Error(`${suffix} APP_URL does not match CLOUDFLARE_CUSTOM_DOMAIN`)
} else if (
  !hostname.startsWith(`${values.CLOUDFLARE_WORKER_NAME}.`) ||
  !hostname.endsWith('.workers.dev')
) {
  throw new Error(`${suffix} APP_URL must use the selected workers.dev name or Custom Domain`)
}
for (const key of ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'])
  if (!configuredUrl(values[key])) throw new Error(`${suffix} ${key} is missing or invalid`)
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
  throw new Error('Cloudflare deploy credentials are missing')
const hosting = process.env.CONVEX_HOSTING || 'cloud'
if (hosting === 'cloud' && !values.CONVEX_DEPLOY_KEY)
  throw new Error(`${suffix} CONVEX_DEPLOY_KEY is missing`)
if (hosting === 'self-hosted' && (!values.CONVEX_URL || !values.CONVEX_ADMIN_KEY))
  throw new Error(`${suffix} self-hosted Convex credentials are missing`)
if (!['cloud', 'self-hosted'].includes(hosting)) throw new Error('CONVEX_HOSTING is invalid')
if (environment === 'production') {
  for (const key of ['APP_URL', 'CLOUDFLARE_WORKER_NAME', 'VITE_CONVEX_URL']) {
    if (!other(key) || values[key] === other(key))
      throw new Error(`Production ${key} must be distinct from a configured preview target`)
  }
  if (hosting === 'cloud' && values.CONVEX_DEPLOY_KEY === other('CONVEX_DEPLOY_KEY'))
    throw new Error('Production and preview Convex deploy keys must differ')
}
if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required to select a deployment target')
for (const [key, value] of Object.entries(values)) {
  if (/[\r\n]/.test(value)) throw new Error(`${key} has an invalid newline`)
  appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`)
}
console.log(`Selected ${environment} deployment inputs`)
