import { expect, test } from '@playwright/test'

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  if (!process.env.E2E_BASE_URL) {
    // These routes do not need backend data. Keep the placeholder subscription
    // offline; real realtime/auth behavior is exercised by the live smoke.
    await page.routeWebSocket('wss://example.convex.cloud/**', () => {})
  }
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

test('public example catalog renders with security headers', async ({ page }) => {
  const response = await page.goto('/examples')

  expect(response?.status()).toBe(200)
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'")
  expect(response?.headers()['x-content-type-options']).toBe('nosniff')
  expect(response?.headers()['x-frame-options']).toBe('DENY')
  await expect(page).toHaveTitle(/Convex|TanStack/i)

  await expect(page.getByRole('heading', { name: 'Feature Examples' })).toBeVisible()
  for (const name of [
    'Realtime Chat',
    'Todos',
    'AI Streaming',
    'Stripe Billing',
    'Transactional Email',
  ]) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
})

test('forms example validates and submits', async ({ page }) => {
  await page.goto('/examples/forms')
  await page.getByRole('button', { name: 'Send Message' }).click()
  await expect(page.getByText('Name must be at least 2 characters')).toBeVisible()

  await page.getByLabel('Name').fill('Browser Test')
  await page.getByLabel('Email').fill('browser@example.com')
  await page.getByLabel('Message').fill('The public smoke flow works.')
  await page.getByRole('button', { name: 'Send Message' }).click()
  await expect(page.getByLabel('Name')).toHaveValue('')
})
