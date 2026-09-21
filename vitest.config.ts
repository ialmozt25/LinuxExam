import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Separate from vite.config.ts on purpose: the app's dev server binds to
// tg-mini-app.local over HTTPS, which must not affect the test runner.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    passWithNoTests: true,
    restoreMocks: true,
    // The Playwright specs live in e2e/ and must not be collected by Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});