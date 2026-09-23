import assert from 'node:assert/strict'
import test from 'node:test'
import { configuredUrl, isConvexCloudPreview, workerName } from './infra-utils.mjs'

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

test('rejects a local Convex backend for the cloud preview', () => {
  assert.equal(isConvexCloudPreview({
    CONVEX_DEPLOYMENT: 'dev:preview',
    VITE_CONVEX_URL: 'https://preview.convex.cloud',
    VITE_CONVEX_SITE_URL: 'https://preview.convex.site',
  }), true)
  assert.equal(isConvexCloudPreview({
    CONVEX_DEPLOYMENT: 'dev:local',
    VITE_CONVEX_URL: 'http://127.0.0.1:3210',
    VITE_CONVEX_SITE_URL: 'http://127.0.0.1:3211',
  }), false)
})
