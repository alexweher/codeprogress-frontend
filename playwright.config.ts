import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/mocked',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mocked-desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mocked-mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
});
