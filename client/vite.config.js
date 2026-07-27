import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const backendTarget = 'http://localhost:3001'

const networkOnly = (urlPattern, methods) =>
  methods.map((method) => ({
    urlPattern,
    handler: 'NetworkOnly',
    method,
  }))

const proxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/socket.io': {
    target: backendTarget,
    changeOrigin: true,
    ws: true,
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: null,
      includeManifestIcons: false,
      manifest: {
        name: 'Trayenco Repartidor',
        short_name: 'Trayenco',
        description: 'Aplicación móvil de repartos de Trayenco',
        lang: 'es-CL',
        id: '/repartidor',
        start_url: '/repartidor',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff,woff2}'],
        globIgnores: ['**/*.map', 'icons.svg', 'favicon.svg'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/,
          /^\/socket\.io(?:\/|$)/,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          ...networkOnly(
            /^https?:\/\/[^/]+\/api(?:\/|$)/,
            ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
          ),
          ...networkOnly(
            /^https?:\/\/[^/]+\/socket\.io(?:\/|$)/,
            ['GET', 'POST'],
          ),
          {
            urlPattern: /^https:\/\/(?:[a-c]\.)?tile\.openstreetmap\.org\//,
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//,
            handler: 'NetworkOnly',
            method: 'GET',
          },
          ...networkOnly(
            /^https:\/\/api\.openrouteservice\.org\//,
            ['GET', 'POST'],
          ),
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    proxy,
  },
})
