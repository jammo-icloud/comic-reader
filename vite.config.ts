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
      includeAssets: [
        'logo.png',
        'unmatched-cover.png',
        'icons/apple-touch-icon-180.png',
        'splash/*.png',
      ],
      manifest: {
        name: 'Bindery',
        short_name: 'Bindery',
        description: 'Your self-hosted comic, manga, and magazine library',
        theme_color: '#030712',
        background_color: '#030712',
        // 'standalone' hides browser chrome on launch from home screen.
        display: 'standalone',
        // Honor device orientation. iOS only enforces in standalone PWAs.
        orientation: 'any',
        start_url: '/',
        // Don't include the leading dot prefix — Vite injects scope automatically.
        icons: [
          // Apple-specific 180×180 (also used by iOS Safari "Add to Home Screen").
          { src: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
          // Generic 512 for Android/Chrome maskable adaptive icon.
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache app shell (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff,woff2}'],
        // Login-bg art lives in subdirectories under public/login-bg/ and is
        // served on-demand via /api/auth/login-bg/* endpoints. Precaching all
        // of it would balloon the SW precache by ~120 MB for content the user
        // only sees if they're not authenticated. Exclude.
        globIgnores: ['**/login-bg/**'],
        // Splash PNGs at the largest resolution (Pro Max 1290×2796) come in
        // ~2.1 MB after the watermark composite — bump the precache limit so
        // they're cacheable for first-launch offline. 3 MiB is the loose cap.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

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
    port: 5880,
    proxy: {
      '/api': 'http://localhost:3000',
      // Express serves cover/thumbnail files at /static — proxy so dev mirrors prod.
      // Without this, Vite's SPA fallback returns index.html for /static/covers/*.jpg
      // and <img> tags fail silently. Works fine on the NAS because Express serves
      // both /static and the SPA from one process.
      '/static': 'http://localhost:3000',
    },
  },
});
