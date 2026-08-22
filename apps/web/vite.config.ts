import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Moley — Social Deduction Party Game',
        short_name: 'Moley',
        description: 'Find the Mole. Protect the word.',
        theme_color: '#17140f',
        background_color: '#f8f3e8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//], runtimeCaching: [] }
    })
  ],
  server: {
    port: 5190,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } }
  },
  build: { target: 'es2022', sourcemap: true }
});
