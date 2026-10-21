# Pasar NOGOYORK a Cloudflare Pages (gratis, permite uso comercial)

Vercel Hobby es solo para uso personal no comercial. Cloudflare Pages es gratis,
permite uso comercial y no limita el ancho de banda del sitio estático.

## Pasos (una sola vez, ~20 minutos)

1. Entrar a https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** y elegir el repo `juanagustinbarret/mapnogo`.
2. Configuración del build:
   - Framework preset: **Vite** (o "None")
   - Build command: `pnpm run build`
   - Build output directory: `dist`
   - Variables de entorno: `NODE_VERSION` = `20`, y las mismas `VITE_...` que
     tengan cargadas en Vercel (ver `env.example`).
3. **Save and Deploy**. Queda publicado en `https://<nombre>.pages.dev`.
4. Probar ahí: inicio, ficha, panel, admin, y que `https://<nombre>.pages.dev/api/clima`
   devuelva el clima (JSON con `temp`).
5. Dominio propio: **Custom domains** → agregar el dominio y seguir los pasos de DNS.
6. En Supabase → **Authentication → URL Configuration**: agregar la URL nueva a
   *Site URL* / *Redirect URLs* (si usan enlaces de Supabase por correo).
7. Cuando todo ande, pausar o borrar el proyecto de Vercel.

## Cómo funciona

- Las rutas de la app (`/comercio/...`, `/panel`, etc.) funcionan solas: si no
  hay un `404.html`, Cloudflare Pages sirve `index.html` (modo SPA). No hace
  falta `_redirects` (la regla `/* /index.html 200` incluso la marca como bucle).
- `functions/api/clima.ts` es la función de `/api/clima` (100.000 pedidos por
  día gratis; con la caché se usan unos pocos por hora).
- `vercel.json` y `api/clima.ts` solo los usa Vercel; se pueden borrar después
  de mudarse.

## Si el build falla

- `pnpm-workspace.yaml` tiene `esbuild: set this to true or false` (texto de
  ejemplo que dejó pnpm). Si el build se queja de esbuild o de scripts de
  instalación bloqueados, cambiarlo a `esbuild: true` (y `core-js: false`).
