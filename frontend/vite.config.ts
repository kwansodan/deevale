import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['launchgh-icon.svg', 'favicon.svg'],
      manifest: {
        name: 'LaunchGH',
        short_name: 'LaunchGH',
        description: 'Register and run your business in Ghana — end to end.',
        theme_color: '#14532D',
        background_color: '#F7F4EE',
        display: 'standalone',
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'launchgh-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the app shell; real-time data (notifications, cases) is
        // always fetched from the network, never served stale from cache.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/pay/, /^\/sign/, /^\/cofounder/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/openapi.json'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
