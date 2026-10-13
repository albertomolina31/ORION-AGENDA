import { defineConfig } from '@playwright/test';

/**
 * Pruebas de extremo a extremo de Orion Business (versión web de la app + API simulada).
 * Un solo worker: la API es una simulación en memoria compartida; cada prueba la reinicia
 * con POST /v1/simulation/reset (habilitado solo aquí con ORION_ALLOW_RESET=1).
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 3200);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8200);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 430, height: 932 },
    locale: 'es-MX',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../apps/api/dist/main.js',
      url: `http://localhost:${API_PORT}/v1/simulation/status`,
      env: { PORT: String(API_PORT), ORION_DISABLE_WORKER: '1', ORION_ALLOW_RESET: '1' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node scripts/serve.mjs .web ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
