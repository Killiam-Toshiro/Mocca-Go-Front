import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 3001;
const MOCK_PORT = 4010;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-360',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    },
  ],
  // Se prueba un build de producción (CSP, cookies y cabeceras reales) contra el back simulado.
  webServer: [
    {
      command: `node tests/mock-api/server.mts`,
      url: `http://127.0.0.1:${MOCK_PORT}/api/v1/menu`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_PORT: String(MOCK_PORT) },
    },
    {
      command: `npm run build && npm run start -- -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        COOKIE_SECURE: 'false',
        API_URL: `http://127.0.0.1:${MOCK_PORT}/api/v1`,
        TRUST_PROXY_HOPS: '0',
      },
    },
  ],
});
