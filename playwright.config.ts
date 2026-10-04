import { defineConfig } from '@playwright/test';

// Deviations from the literal spec, both required to make E2E runnable here:
// 1. Both stands are pinned to --host 127.0.0.1: the dev server is configured
//    with host 'tg-mini-app.local', which needs a hosts-file entry (admin
//    rights); without the override Vite exits with EADDRNOTAVAIL.
// 2. TWO stands (spec 078): the visual-regression baselines must be shot from a
//    PRODUCTION build (`npm run build && npm run preview`), because the dev
//    build renders the debug badge from `src/App.tsx` that used to be baked into
//    every baseline. The rest of the suite keeps the dev stand: three specs
//    (`browser-mode.spec.ts`, `tma-mode.spec.ts`) assert that very badge as the
//    observable proxy for "the app sees Telegram", and it cannot render in a
//    production build (`import.meta.env.DEV === false`). Both `vite dev` and
//    `vite preview` inherit `server.https` from vite.config.ts (mkcert), so both
//    stands speak HTTPS and every URL is pinned to the loopback address.
const DEV_URL = 'https://127.0.0.1:5173';
const PREVIEW_URL = 'https://127.0.0.1:4173';

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
      // spec 078: Playwright fills every `mask` box with #F0F (magenta) by
      // default, which the visual audit read as a UI colour defect. The page
      // background is neutral, so masked regions no longer read as an artefact.
      //
      // NOTE (verified, playwright 1.63.0): this line is INERT. `mask` and
      // `maskColor` are listed in `NonConfigProperties`
      // (node_modules/playwright/lib/matchers/expect.js) and are deleted from
      // the config options before use, so only the call-site value counts —
      // see `e2e/visual-regression.spec.ts`. The colour is kept here because the
      // spec's acceptance criterion names this file; the effective option is at
      // the call site.
      maskColor: '#f5f5f5',
    },
  },
  // Snapshot paths are pinned to the layout spec 074 committed. With `projects`
  // defined Playwright's default template inserts `{-projectName}` into the file
  // name; that would create 19 new files instead of regenerating the existing
  // baselines in place.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{-snapshotSuffix}{ext}',
  projects: [
    {
      // spec 078: production stand — only the visual-regression baselines.
      name: 'stand-prod',
      testMatch: /visual-regression\.spec\.ts/,
      use: { baseURL: PREVIEW_URL },
    },
    {
      // Everything else stays on the dev stand (unchanged from spec 074/075).
      name: 'stand-dev',
      testIgnore: /visual-regression\.spec\.ts/,
      use: { baseURL: DEV_URL },
    },
  ],
  use: {
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // spec 078: production build stand for the visual-regression project.
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`,
      url: PREVIEW_URL,
      reuseExistingServer: true,
      // The command now includes the build; the default 60 s is too tight for it.
      timeout: 180_000,
      ignoreHTTPSErrors: true,
    },
    {
      // Dev stand for the specs that assert the DEV-only debug badge.
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: DEV_URL,
      reuseExistingServer: true,
      ignoreHTTPSErrors: true,
    },
  ],
});
