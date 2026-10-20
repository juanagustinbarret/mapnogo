// Vercel (Edge Function): /api/google — reseñas de Google y búsqueda para el admin.
// La clave va en la variable de entorno GOOGLE_PLACES_API_KEY (Vercel →
// Settings → Environment Variables). Nunca en el código ni en VITE_*.
// La lógica está en src/lib/googleServidor.ts.
import { responderGoogle } from '../src/lib/googleServidor';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

export default function handler(request: Request): Promise<Response> {
  return responderGoogle(request, {
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    GOOGLE_LIMITE_DIARIO: process.env.GOOGLE_LIMITE_DIARIO,
  });
}
