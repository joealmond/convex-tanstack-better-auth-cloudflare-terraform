#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { assertDeployedOrigin } from './infra-utils.mjs'

const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'))
const output = process.argv.includes('--preflight')
  ? undefined
  : `${process.env.WRANGLER_OUTPUT || ''}\n${process.env.WRANGLER_DEPLOYMENT_URL || ''}`
assertDeployedOrigin(process.env.APP_URL, config, output)
console.log('PASS deployed Worker origin matches APP_URL')
