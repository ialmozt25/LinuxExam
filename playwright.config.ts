import { defineConfig } from '@playwright/test';

// Deviations from the literal spec, both required to make E2E runnable here:
// 1. The dev server is configured with host 'tg-mini-app.local', which needs a
//    hosts-file entry (admin rights). Overriding with --host 127.0.0.1 keeps E2E
//    self-contained; without it Vite exits with EADDRNOTAVAIL.
// 2. vite.config.ts sets server.https = true (mkcert), so the dev server speaks
//    HTTPS only — baseURL and webServer.url must therefore be https.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'https://localhost:5173',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
});