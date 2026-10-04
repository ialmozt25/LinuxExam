import { defineConfig } from '@playwright/test';

// Deviations from the literal spec, both required to make E2E runnable here:
// 1. The dev server is configured with host 'tg-mini-app.local', which needs a
//    hosts-file entry (admin rights). Overriding with --host 127.0.0.1 keeps E2E
//    self-contained; without it Vite exits with EADDRNOTAVAIL.
// 2. vite.config.ts sets server.https = true (mkcert), so the dev server speaks
//    HTTPS only — baseURL and webServer.url must therefore be https.
export default defineConfig({
  testDir: './e2e',
  // spec 074: visual-regression contract. The app animates through `motion`, and a
  // frame painted mid-transition is not a stable artefact — hence
  // `animations: 'disabled'`. 1 % of differing pixels plus a per-pixel colour
  // threshold of 0.2 absorb sub-pixel antialiasing drift between runs without
  // hiding a real layout or colour change.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
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
