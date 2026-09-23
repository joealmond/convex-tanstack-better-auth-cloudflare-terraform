import { defineConfig, devices } from '@playwright/test'

const localPort = Number(process.env.E2E_PORT || 4173)
const localBaseUrl = `http://127.0.0.1:${localPort}`

const liveBaseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: liveBaseUrl || localBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: liveBaseUrl
    ? undefined
    : {
        command: `npm run dev:web -- --host 127.0.0.1 --port ${localPort} --strictPort`,
        url: `${localBaseUrl}/examples`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_CONVEX_URL: 'https://example.convex.cloud',
          VITE_CONVEX_SITE_URL: 'https://example.convex.site',
          VITE_APP_ENV: 'development',
          VITE_SENTRY_DSN: '',
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'output/playwright/results',
})
