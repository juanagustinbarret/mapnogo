// Vercel (Edge Function): GET /api/clima
// Mismo servicio que functions/api/clima.ts (Cloudflare Pages), para que el
// clima funcione en el hosting que se use. La caché la hace la CDN de Vercel
// con el encabezado Cache-Control (s-maxage). La lógica está en src/lib/clima.ts.
import { responderClima } from '../src/lib/clima';

export const config = { runtime: 'edge' };

export default function handler(): Promise<Response> {
  return responderClima();
}
