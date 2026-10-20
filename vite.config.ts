import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { responderClima } from './src/lib/clima';
import { responderGoogle } from './src/lib/googleServidor';

// Solo en desarrollo (pnpm dev): atiende /api/clima igual que la función de
// Cloudflare Pages / Vercel, para que el widget del clima se vea en local.
const climaEnDesarrollo = (): Plugin => ({
  name: 'nogomap-api-desarrollo',
  apply: 'serve',
  configureServer(server) {
    // /api/google en desarrollo: usa GOOGLE_PLACES_API_KEY de la terminal si
    // está; si no, responde "no configurado" y la ficha sigue funcionando.
    server.middlewares.use('/api/google', async (req, res) => {
      const partes: Buffer[] = [];
      for await (const parte of req) partes.push(parte as Buffer);
      const peticion = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'POST' ? Buffer.concat(partes) : undefined,
      });
      const respuesta = await responderGoogle(peticion, {
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
        SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      });
      res.statusCode = respuesta.status;
      respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
      res.end(await respuesta.text());
    });
    server.middlewares.use('/api/clima', async (_req, res) => {
      const respuesta = await responderClima();
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
