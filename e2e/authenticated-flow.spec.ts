import { expect, test } from '@playwright/test'

test.describe('live authenticated smoke', () => {
  test.skip(
    process.env.E2E_RUN_AUTH !== 'true' || !process.env.E2E_BASE_URL,
    'Set E2E_BASE_URL and E2E_RUN_AUTH=true to exercise the deployed backend.'
  )

  test('sign up, send a message, and upload a file', async ({ page }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const email = `convexkit-e2e-${unique}@example.com`
    const password = `ConvexKit-${unique}-Password!`
    const message = `E2E message ${unique}`
    const fileName = `e2e-${unique}.txt`

    await page.goto('/examples/chat')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const authMode = page.getByRole('group', { name: 'Authentication mode' })
    await authMode.getByRole('button', { name: 'Create account' }).click()
    const authForm = page.locator('form').filter({ has: page.getByLabel('Email') })
    await authForm.getByLabel('Name').fill('ConvexKit E2E')
    await authForm.getByLabel('Email').fill(email)
    await authForm.getByLabel('Password').fill(password)
    await authForm.locator('button[type="submit"]').click()

    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
    await page.getByPlaceholder('Type a message...').fill(message)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(message)).toBeVisible()

    await page.getByRole('link', { name: 'Files' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('ConvexKit authenticated upload smoke test'),
    })
    await expect(page.getByText(fileName)).toBeVisible()
  })
})
