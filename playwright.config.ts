import { defineConfig, devices } from '@playwright/test'

const origin = 'http://127.0.0.1:4173'
const baseURL = `${origin}/Watteau-horizon/`

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 960 },
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: 'node tests/serve-dist.mjs',
    url: baseURL,
    reuseExistingServer: false,
  },
})
