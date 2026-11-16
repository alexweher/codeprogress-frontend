import { defineConfig } from '@playwright/test';

const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
const mockedBaseUrl =
  runtime.process?.env?.CODEPROGRESS_MOCK_E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e/mocked',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  outputDir: 'test-results',
  use: {
    baseURL: mockedBaseUrl,
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
