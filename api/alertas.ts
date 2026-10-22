// Vercel (Edge Function): GET /api/alertas
// Alertas del SMN para Nogoyá, leídas de Supabase (las guarda el cron
// alertas-smn). Usa la anon key, que es pública. La caché la hace la CDN de
// Vercel con el encabezado Cache-Control (s-maxage). La lógica está en
// src/lib/alertasSmn.ts.
import { responderAlertas } from '../src/lib/alertasSmn';

export const config = { runtime: 'edge' };

export default function handler(): Promise<Response> {
  return responderAlertas({ url: process.env.VITE_SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY });
}
