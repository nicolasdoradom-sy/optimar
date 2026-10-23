import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: 'line',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4175/optimar/',
    headless: true,
  },
  webServer: {
    command: 'VITE_BASE_PATH=/optimar/ npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/optimar/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});