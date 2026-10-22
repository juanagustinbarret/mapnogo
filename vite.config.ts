import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { responderClima } from './src/lib/clima';
import { responderAlertas } from './src/lib/alertasSmn';

// Solo en desarrollo (pnpm dev): atiende /api/clima igual que la función de
// Cloudflare Pages / Vercel, para que el widget del clima se vea en local.
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
  plugins: [react(), climaEnDesarrollo()],
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
