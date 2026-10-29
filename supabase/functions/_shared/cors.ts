// supabase/functions/_shared/cors.ts
//
// CORS de las Edge Functions que llama el sitio: solo los orígenes de la lista
// pueden leer las respuestas desde un navegador. La lista sale de
// ORIGENES_PERMITIDOS (separada por comas); si no está, el sitio publicado y
// el de desarrollo. No frena a un script que llame directo: eso lo hacen la
// sesión y los permisos de cada función. Sin dependencias.

export const ORIGENES_POR_DEFECTO = ['https://mapnogo.vercel.app', 'http://localhost:3000'];

export function origenesPermitidos(valor: string | undefined): string[] {
  const lista = (valor ?? '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
  return lista.length ? lista : ORIGENES_POR_DEFECTO;
}

/** Devuelve la respuesta con Access-Control-Allow-Origin solo si el origen del pedido está en la lista. */
export function conCors(req: Request, res: Response, permitidos: string[]): Response {
  const encabezados = new Headers(res.headers);
  encabezados.delete('Access-Control-Allow-Origin');
  encabezados.append('Vary', 'Origin');
  const origen = req.headers.get('origin');
  if (origen && permitidos.includes(origen)) encabezados.set('Access-Control-Allow-Origin', origen);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: encabezados });
}
