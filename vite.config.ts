import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { responderClima } from './src/lib/clima';
import { responderAlertas } from './src/lib/alertasSmn';

// Solo en desarrollo (pnpm dev): atiende /api/clima y /api/alertas
const climaEnDesarrollo = (): Plugin => ({
  name: 'nogoyork-clima-desarrollo',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/clima', async (_req, res) => {
      const respuesta = await responderClima();
      res.statusCode = respuesta.status;
      respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
      res.end(await respuesta.text());
    });
    server.middlewares.use('/api/alertas', async (_req, res) => {
      const env = server.config.env;
      const respuesta = await responderAlertas({ url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY });
      res.statusCode = respuesta.status;
      respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
      res.end(await respuesta.text());
    });
  },
});

export default defineConfig({
  plugins: [
    react(),
    climaEnDesarrollo(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'manifest.json'],
      manifest: {
        name: 'NOGOYORK - Plataforma Comercial',
        short_name: 'Nogoyork',
        description: 'Guía comercial e interactiva de Nogoyá',
        theme_color: '#2b6cb0',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Precachea todos los .js, .css e imágenes generadas en la carpeta dist/
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Redirección SPA para rutas como /comercio/:slug
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});