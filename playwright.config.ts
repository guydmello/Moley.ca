import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const workerStateDir = join(tmpdir(), `moley-playwright-${process.pid}`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: externalBaseURL ?? 'http://127.0.0.1:5190', trace: 'on-first-retry' },
  webServer: externalBaseURL ? undefined : [
    {
      command: `npm run dev -w @moley/worker -- --persist-to ${workerStateDir}`,
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npm run dev -w @moley/web',
      url: 'http://127.0.0.1:5190',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ],
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'ios-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
  ]
});
