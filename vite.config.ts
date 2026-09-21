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
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: 'localhost',
    https: true,
  },
});
