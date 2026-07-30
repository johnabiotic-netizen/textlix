import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

// `isSsrBuild` is true for the prerender pass (`vite build --ssr ...`). That pass
// only needs to bundle the marketing route components for Node — it must NOT run
// the PWA/compression plugins or the client chunk splitting.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    // Client-build-only plugins: pre-compressed assets + the PWA service worker.
    ...(isSsrBuild
      ? []
      : [
          // Generate pre-compressed .gz and .br files at build time.
          // The `serve` static server automatically serves these when supported.
          viteCompression({ algorithm: 'gzip' }),
          viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
          VitePWA({
            registerType: 'autoUpdate',
            // We register the SW ourselves in main.jsx (with update polling), so
            // don't also auto-inject the bare registerSW.js — that one never
            // checks for updates, which left users on a stale build until they
            // cleared cache.
            injectRegister: false,
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
            manifest: {
              name: 'Textlix',
              short_name: 'Textlix',
              description: 'Get virtual phone numbers from 50+ countries. Receive SMS verification codes instantly.',
              theme_color: '#0A1831',
              background_color: '#0A1831',
              display: 'standalone',
              orientation: 'portrait',
              scope: '/',
              start_url: '/',
              icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ],
              screenshots: [
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', form_factor: 'narrow' },
              ],
            },
            workbox: {
              // Take control of open pages the moment the new SW activates. Without
              // clientsClaim the updated SW never becomes the controller of an
              // already-open tab, so `controllerchange` never fires and the page
              // keeps running the OLD bundle until a manual cache-clear/refresh —
              // which is why new deploys weren't reaching users automatically.
              clientsClaim: true,
              skipWaiting: true,
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              // Prerendered marketing pages are real HTML files (generated after
              // this SW manifest is built). Keep the SW's navigation fallback from
              // serving the cached SPA shell for these routes — let the network
              // return the prerendered HTML instead. App routes still fall back to
              // the shell.
              navigateFallbackDenylist: [
                /^\/virtual-numbers(\/|$)/,
                /^\/pricing(\/|$)/,
                /^\/about(\/|$)/,
                /^\/docs(\/|$)/,
                /^\/faq(\/|$)/,
                /^\/support(\/|$)/,
                /^\/terms(\/|$)/,
                /^\/privacy(\/|$)/,
                /^\/blog(\/|$)/,
              ],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com/,
                  handler: 'CacheFirst',
                  options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
                },
              ],
            },
          }),
        ]),
  ],
  build: {
    rollupOptions: {
      output: isSsrBuild
        ? {}
        : {
            manualChunks: {
              // React core — changes rarely, long cache life
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              // Data fetching / state
              'vendor-query': ['@tanstack/react-query', 'axios', 'zustand'],
              // Charts — only used in admin, isolated so regular users never download it
              'vendor-charts': ['recharts'],
              // Real-time
              'vendor-socket': ['socket.io-client'],
              // UI utilities
              'vendor-ui': ['react-hot-toast', 'react-icons', 'dayjs', 'react-helmet-async'],
            },
          },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy Socket.io (incl. the WebSocket upgrade) to the backend in dev.
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
}));
