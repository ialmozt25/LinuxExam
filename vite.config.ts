import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  // Cloudflare Pages serves this site from the domain root (base '/'), while
  // GitHub Pages serves a project repo from /LinuxExam/. A single static build
  // cannot serve both, so the base is injected per environment at build time.
  base: process.env.VITE_BASE ?? '/',
  // vite-plugin-mkcert installs a local CA and hangs in CI (no admin rights); it
  // is only needed for the HTTPS dev server, so it is skipped when CI is set.
  plugins: [react(), ...(process.env.CI ? [] : [mkcert()])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // lucide-react is a barrel of ~1600 icon modules. Excluding it from dependency
  // pre-bundling made every dev page load fetch all of them — measured ~1600
  // module requests per context, 5.6-6.7 s to the dashboard warm and 12.8-17.2 s
  // cold, which is what made `npm run test:e2e` time out on the first test of each
  // Playwright worker (spec 049). Pre-bundling serves the same icons in ~55
  // requests (~1.7 s warm).
  optimizeDeps: {
    include: ['lucide-react'],
  },
  server: {
    host: 'localhost',
    https: true,
  },
});
