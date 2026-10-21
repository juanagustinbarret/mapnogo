// src/lib/migrarClavesLocales.ts
//
// Cambio de nombre NOGOMAP → NOGOYORK (21/10/2026). Las claves que el sitio
// guarda en el navegador también cambiaron de nombre. Para no perder lo que
// cada persona ya tenía guardado, al abrir el sitio se copia el valor de la
// clave vieja a la nueva (una sola vez) y se borra la vieja:
//   - visitante: si no, cada visitante se contaría de nuevo en las métricas;
//   - interacciones recientes: evita contar dos veces un toque reciente;
//   - reseñas enviadas: el aviso "ya dejaste una reseña" en ese navegador;
//   - geocodificación: el caché de direcciones de la calle.
// Se puede borrar este archivo en unos meses.

export const CLAVES_RENOMBRADAS: ReadonlyArray<readonly [vieja: string, nueva: string]> = [
  ['nogomap:visitante', 'nogoyork:visitante'],
  ['nogomap:interacciones-recientes', 'nogoyork:interacciones-recientes'],
  ['nogomap:resenas-enviadas:v1', 'nogoyork:resenas-enviadas:v1'],
  ['nogomap:geocodificacion:v1', 'nogoyork:geocodificacion:v1'],
];

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function migrarClavesLocales(almacen?: Almacen | null) {
  try {
    const a = almacen ?? (typeof localStorage === 'undefined' ? null : localStorage);
    if (!a) return;
    for (const [vieja, nueva] of CLAVES_RENOMBRADAS) {
      const valor = a.getItem(vieja);
      if (valor === null) continue;
      if (a.getItem(nueva) === null) a.setItem(nueva, valor);
      a.removeItem(vieja);
    }
  } catch {
    // Sin acceso al almacenamiento (modo privado, bloqueado): no pasa nada
  }
}
