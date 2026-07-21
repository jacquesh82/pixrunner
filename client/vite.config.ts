import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PixRunner',
        short_name: 'PixRunner',
        description: 'Conquête de territoire IRL en temps réel',
        theme_color: '#4a86ff',
        background_color: '#eef2f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // La carte et le jeu sont temps réel : on met en cache la coquille de l'app.
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
