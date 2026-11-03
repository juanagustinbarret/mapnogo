// src/lib/recaudacion.ts

export interface Recaudacion {
  total: number;
  /** Primer y último día del mes (aaaa-mm-dd) */
  desde: string;
  hasta: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Obtiene primer y último día del mes corriente local */
function fechasMesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const ultimoDia = new Date(anio, hoy.getMonth() + 1, 0).getDate();
  
  return {
    desde: `${anio}-${mes}-01`,
    hasta: `${anio}-${mes}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

export function leerRecaudacion(datos: unknown): Recaudacion {
  const fechasDefault = fechasMesActual();

  if (!datos || typeof datos !== 'object') {
    return { total: 0, ...fechasDefault };
  }

  const d = datos as { total?: unknown; total_centavos?: unknown; desde?: unknown; hasta?: unknown };
  const numRaw = d.total ?? d.total_centavos;
  const valor = numRaw !== null && numRaw !== undefined ? Number(numRaw) : 0;
  
  const totalLimpio = Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : 0;
  const desdeLimpio = typeof d.desde === 'string' && FECHA.test(d.desde) ? d.desde : fechasDefault.desde;
  const hastaLimpio = typeof d.hasta === 'string' && FECHA.test(d.hasta) ? d.hasta : fechasDefault.hasta;
  
  return {
    total: totalLimpio,
    desde: desdeLimpio,
    hasta: hastaLimpio,
  };
}

/** "noviembre de 2026" a partir del primer día del mes */
export const nombreDelMes = (desde: string): string =>
  new Date(`${desde}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });