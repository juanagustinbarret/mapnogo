// supabase/functions/_shared/moderacion.ts
//
// Moderación automática de imágenes ANTES de publicarlas. Proveedor elegido
// con el secreto MODERACION_PROVEEDOR:
//   - "openai": endpoint de moderación de OpenAI (omni-moderation-latest),
//     gratis; necesita OPENAI_API_KEY.
//   - "google": Cloud Vision SafeSearch; 1.000 imágenes gratis por mes y
//     después USD 1,50 cada 1.000; necesita GOOGLE_VISION_API_KEY.
//   - sin configurar: no hay moderación automática y TODA foto nueva queda
//     "pendiente" hasta que un admin la apruebe (gratis, pero manual).
// Si el proveedor falla o no responde, la foto también queda pendiente:
// nunca se publica algo sin revisar por un error.

export type EstadoModeracion = 'aprobada' | 'pendiente' | 'rechazada';

export interface Veredicto {
  estado: EstadoModeracion;
  proveedor: 'openai' | 'google' | 'ninguno';
  motivo: string;
  puntajes?: Record<string, number | string>;
}

// Umbrales (0 a 1). "Rechazada": claramente explícita, no se guarda.
// "Pendiente": dudosa, la tiene que ver un admin.
export const UMBRALES_OPENAI = {
  rechazar: { sexual: 0.85 },
  revisar: { sexual: 0.3, 'violence/graphic': 0.5, violence: 0.8, 'self-harm': 0.4 },
};

export function veredictoOpenAI(respuesta: unknown): Veredicto {
  const r = (respuesta as { results?: { flagged?: boolean; category_scores?: Record<string, number> }[] })?.results?.[0];
  const p = r?.category_scores;
  if (!p) return { estado: 'pendiente', proveedor: 'openai', motivo: 'respuesta_invalida' };
  const puntajes = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number' && v >= 0.01).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
  for (const [cat, tope] of Object.entries(UMBRALES_OPENAI.rechazar)) {
    if ((p[cat] ?? 0) >= tope) return { estado: 'rechazada', proveedor: 'openai', motivo: cat, puntajes };
  }
  for (const [cat, tope] of Object.entries(UMBRALES_OPENAI.revisar)) {
    if ((p[cat] ?? 0) >= tope) return { estado: 'pendiente', proveedor: 'openai', motivo: cat, puntajes };
  }
  if (r?.flagged) return { estado: 'pendiente', proveedor: 'openai', motivo: 'marcada', puntajes };
  return { estado: 'aprobada', proveedor: 'openai', motivo: 'ok', puntajes };
}

const NIVELES = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
const nivel = (v: unknown) => Math.max(0, NIVELES.indexOf(String(v)));

export function veredictoGoogle(respuesta: unknown): Veredicto {
  const s = (respuesta as { responses?: { safeSearchAnnotation?: Record<string, string>; error?: unknown }[] })?.responses?.[0]?.safeSearchAnnotation;
  if (!s) return { estado: 'pendiente', proveedor: 'google', motivo: 'respuesta_invalida' };
  const puntajes = { adult: s.adult, racy: s.racy, violence: s.violence, medical: s.medical };
  if (nivel(s.adult) >= nivel('VERY_LIKELY')) return { estado: 'rechazada', proveedor: 'google', motivo: 'adult', puntajes };
  if (nivel(s.adult) >= nivel('POSSIBLE')) return { estado: 'pendiente', proveedor: 'google', motivo: 'adult', puntajes };
  if (nivel(s.racy) >= nivel('LIKELY')) return { estado: 'pendiente', proveedor: 'google', motivo: 'racy', puntajes };
  if (nivel(s.violence) >= nivel('LIKELY')) return { estado: 'pendiente', proveedor: 'google', motivo: 'violence', puntajes };
  return { estado: 'aprobada', proveedor: 'google', motivo: 'ok', puntajes };
}

function base64(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function moderarImagen(
  bytes: Uint8Array,
  mime: string,
  config: { proveedor?: string; openaiKey?: string; googleKey?: string; fetch: typeof fetch; tiempoMaximoMs?: number },
): Promise<Veredicto> {
  const proveedor = (config.proveedor ?? '').toLowerCase();
  const limite = AbortSignal.timeout(config.tiempoMaximoMs ?? 15_000);
  try {
    if (proveedor === 'openai' && config.openaiKey) {
      const r = await config.fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${base64(bytes)}` } }] }),
        signal: limite,
      });
      if (!r.ok) return { estado: 'pendiente', proveedor: 'openai', motivo: `error_http_${r.status}` };
      return veredictoOpenAI(await r.json());
    }
    if (proveedor === 'google' && config.googleKey) {
      const r = await config.fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(config.googleKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ image: { content: base64(bytes) }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }] }),
        signal: limite,
      });
      if (!r.ok) return { estado: 'pendiente', proveedor: 'google', motivo: `error_http_${r.status}` };
      return veredictoGoogle(await r.json());
    }
  } catch (e) {
    return { estado: 'pendiente', proveedor: proveedor === 'google' ? 'google' : 'openai', motivo: `error_${(e as Error)?.name ?? 'desconocido'}` };
  }
  return { estado: 'pendiente', proveedor: 'ninguno', motivo: 'sin_moderacion_automatica' };
}
