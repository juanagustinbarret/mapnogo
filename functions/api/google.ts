// Cloudflare Pages Function: /api/google — reseñas de Google y búsqueda para el admin.
// La clave va en la variable GOOGLE_PLACES_API_KEY (Pages → Settings →
// Variables and Secrets, tipo "Secret"). Sin caché: los términos de Google
// no permiten guardar puntajes ni reseñas. La lógica está en src/lib/googleServidor.ts.
import { responderGoogle, type Entorno } from '../../src/lib/googleServidor';

interface Contexto {
  request: Request;
  env: Entorno & { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}

export function onRequest({ request, env }: Contexto): Promise<Response> {
  return responderGoogle(request, {
    ...env,
    SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
  });
}
