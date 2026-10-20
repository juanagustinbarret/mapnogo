// Cloudflare Pages Function: GET /api/clima
// Consulta el clima de Nogoyá a MET Norway y lo guarda en la caché de
// Cloudflare (como mucho una consulta cada 5–30 minutos para todos los
// visitantes, como pide MET Norway). La lógica está en src/lib/clima.ts.
import { responderClima } from '../../src/lib/clima';

interface Contexto {
  request: Request;
  waitUntil: (promesa: Promise<unknown>) => void;
}

export async function onRequestGet({ request, waitUntil }: Contexto): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const clave = new Request(new URL('/api/clima', request.url).toString(), { method: 'GET' });

  const guardada = await cache.match(clave);
  if (guardada) return guardada;

  const respuesta = await responderClima();
  if (respuesta.ok) waitUntil(cache.put(clave, respuesta.clone()));
  return respuesta;
}
