import { defineConfig } from '@playwright/test';
import { realE2EConfig } from './e2e/real-backend/runtimeConfig';

export default defineConfig({
  testDir: './e2e/real-backend',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['line']],
  outputDir: 'test-results-real',
  use: {
    baseURL: realE2EConfig.baseURL,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'real-backend' }],
});
