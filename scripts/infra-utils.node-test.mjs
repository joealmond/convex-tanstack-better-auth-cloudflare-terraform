import assert from 'node:assert/strict'
import test from 'node:test'
import { configuredUrl, workerName } from './infra-utils.mjs'

test('accepts real URLs and rejects starter placeholders', () => {
  assert.equal(configuredUrl('https://preview.convex.cloud'), true)
  assert.equal(configuredUrl('https://your-deployment.convex.cloud'), false)
  assert.equal(configuredUrl('not a URL'), false)
})

test('requires a portable Worker name', () => {
  assert.equal(workerName('my-app-preview'), true)
  assert.equal(workerName('My app'), false)
  assert.equal(workerName('-preview'), false)
})
