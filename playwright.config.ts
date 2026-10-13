import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] } : {},
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 15000 },
});
