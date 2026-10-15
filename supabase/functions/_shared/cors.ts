// Orígenes permitidos: variable ALLOWED_ORIGINS separada por comas
// (por ejemplo "https://nogomap.vercel.app,http://localhost:3000").
// Si no está configurada, se acepta cualquier origen.
const permitidos = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsHeaders = (req: Request): Record<string, string> => {
  const origen = req.headers.get('Origin') ?? '';
  const permitido = permitidos.length === 0 ? '*' : permitidos.includes(origen) ? origen : permitidos[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

export const jsonResponse = (req: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
