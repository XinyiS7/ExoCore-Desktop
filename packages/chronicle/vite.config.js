import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isWatch = process.argv.includes('--watch');

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/chronicle/' : '/',
  plugins: [
    react(),
    !isWatch && VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      manifest: {
        id: 'exocore-chronicle',
        name: 'ExoCore Chronicle',
        short_name: 'Chronicle',
        description: 'ExoCore Timeline & Task Management',
        theme_color: '#faf6f0',
        background_color: '#faf6f0',
        display: 'standalone',
        start_url: command === 'build' ? '/chronicle/' : '/',
        scope: command === 'build' ? '/chronicle/' : '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
}))
