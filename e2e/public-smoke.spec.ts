import { expect, test } from '@playwright/test'

test('landing page and example catalog render', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Convex|TanStack/i)

  await page.goto('/examples')
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
