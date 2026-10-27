// supabase/functions/_shared/moderacionResenas.ts
//
// Reglas de los pedidos de eliminación de reseñas. Las usan la Edge Function
// moderar-resenas (que es la que decide) y el panel (para avisar antes de
// mandar). Sin dependencias.

export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;
export const NOTA_MAX = 500;
export const LIMITE_SOLICITUDES_POR_DIA = 5;

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export function validarMotivo(texto: unknown): { ok: true; motivo: string } | { ok: false; error: string } {
  const motivo = typeof texto === 'string' ? texto.trim() : '';
  if (motivo.length < MOTIVO_MIN) return { ok: false, error: `Contá el motivo (al menos ${MOTIVO_MIN} caracteres).` };
  if (motivo.length > MOTIVO_MAX) return { ok: false, error: `El motivo puede tener hasta ${MOTIVO_MAX} caracteres.` };
  return { ok: true, motivo };
}

export function validarNota(texto: unknown): { ok: true; nota: string | null } | { ok: false; error: string } {
  const nota = typeof texto === 'string' ? texto.trim() : '';
  if (nota.length > NOTA_MAX) return { ok: false, error: `La nota puede tener hasta ${NOTA_MAX} caracteres.` };
  return { ok: true, nota: nota || null };
}
