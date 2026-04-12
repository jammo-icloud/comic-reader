import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['logo.png', 'unmatched-cover.png'],
      manifest: {
        name: 'Comic Reader',
        short_name: 'Comics',
        description: 'Read your comic collection offline',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache app shell (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff,woff2}'],

        runtimeCaching: [
          // Cache API responses (library data, series info) — network-first, fall back to cache
          {
            urlPattern: /^\/api\/(comics|series|continue-reading|shelves)(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
              networkTimeoutSeconds: 3,
            },
          },
          // Cache series covers — cache-first (they rarely change)
          {
            urlPattern: /^\/api\/series-cover\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'series-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
          // Cache thumbnails — cache-first
          {
            urlPattern: /^\/api\/thumbnails\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'thumbnails',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
          // Cache PDFs — cache-first with size limit (recently read)
          {
            urlPattern: /^\/api\/comics\/read\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-cache',
              expiration: {
                maxEntries: 20, // Keep last 20 PDFs
                maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200, 206] },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
