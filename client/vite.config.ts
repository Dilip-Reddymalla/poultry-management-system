import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Registration is explicit in src/pwa/register.ts so the update lifecycle
      // stays visible in application code.
      injectRegister: null,
      registerType: 'autoUpdate',
      // The icons are already picked up by the workbox glob below; without this
      // they would be listed in the precache manifest twice.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Poultry Management System',
        short_name: 'Poultry Manager',
        description:
          'Farm operations for poultry: employees, farms, sheds and shed status in one place.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#16211c',
        background_color: '#f2f0e9',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Static application assets only. There is deliberately no runtime
        // caching rule for the API: every /api request goes to the network, so
        // one user's employee, farm, shed or session data can never be served
        // from a shared cache to another user of the same device.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      // The dev server stays a plain Vite server; the service worker only ships
      // in production builds.
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
