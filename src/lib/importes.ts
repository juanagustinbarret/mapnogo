// src/lib/importes.ts

/** "$ 10.000" → 10000 ; null si no es un importe entero válido mayor a 0. */
export function leerImporte(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto > 0 ? Math.round(texto) : null;
  if (!texto) return null;
  
  let limpio = String(texto).replace(/\$/g, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(limpio)) return null;

  if (limpio.includes(',')) {
    limpio = limpio.split(',')[0].replace(/\./g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');
  }
  
  if (!/^\d+$/.test(limpio)) return null;
  const valor = parseInt(limpio, 10);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}