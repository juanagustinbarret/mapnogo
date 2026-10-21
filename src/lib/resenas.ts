// src/lib/resenas.ts
//
// Reseñas: la base no garantiza que "estrellas" esté entre 1 y 5 (la tabla se
// creó a mano, sin restricción). Con un valor negativo o no entero,
// [...Array(n)] lanza RangeError y se cae la ficha entera.

export const LARGO_NOMBRE = 60;
export const LARGO_COMENTARIO = 1000;

/** Cantidad de estrellas a dibujar: entero entre 0 y 5. */
export function estrellasValidas(valor: unknown): number {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

// ─── Una reseña por conexión (IP) y por comercio ─────────────────────────
// El límite lo pone la base (supabase/propuestas/20261020_resenas_una_por_ip.sql):
// guarda una huella cifrada de la IP y no deja una segunda reseña del mismo
// comercio desde la misma conexión. El navegador solo recuerda, como ayuda,
// en qué comercios ya opinó esta persona.

/** Columnas de una reseña que usa la app (la huella de la IP nunca se pide). */
export const COLUMNAS_RESENA = 'id, comercio_id, nombre_usuario, estrellas, comentario, created_at';

export const MENSAJE_YA_RESENO = 'Ya dejaste una reseña para este comercio. ¡Gracias por opinar!';

/** Mensaje para la persona según el error de la base al publicar. */
export function mensajeErrorResena(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return '';
  if (error.code === '23505') return MENSAJE_YA_RESENO;
  if (error.code === '23514') return 'Revisá la reseña: las estrellas van de 1 a 5 y el texto no puede ser tan largo.';
  return 'No se pudo publicar la reseña. Probá de nuevo en un rato.';
}

export const CLAVE_LOCAL_RESENAS = 'nogoyork:resenas-enviadas:v1';
const CLAVE_LOCAL = CLAVE_LOCAL_RESENAS;

function leerEnviadas(almacen: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const valor = JSON.parse(almacen?.getItem(CLAVE_LOCAL) ?? '[]');
    return Array.isArray(valor) ? valor.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const almacenLocal = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** ¿Este navegador ya dejó una reseña en ese comercio? (solo para avisar antes) */
export function yaReseno(comercioId: string, almacen: Pick<Storage, 'getItem'> | null = almacenLocal()): boolean {
  return leerEnviadas(almacen).includes(comercioId);
}

export function marcarResenado(comercioId: string, almacen: Pick<Storage, 'getItem' | 'setItem'> | null = almacenLocal()): void {
  try {
    const lista = leerEnviadas(almacen).filter((id) => id !== comercioId);
    almacen?.setItem(CLAVE_LOCAL, JSON.stringify([comercioId, ...lista].slice(0, 300)));
  } catch {
    // Navegación privada o almacenamiento lleno: el límite real lo pone la base
  }
}
