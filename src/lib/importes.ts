// src/lib/importes.ts
//
// Importes escritos a mano en formato argentino. En Argentina el punto separa
// miles ("10.000" son diez mil): con parseFloat daba 10, y un pago de
// $ 10.000 se registraba como $ 10. Tampoco se aceptan 0 ni negativos, que
// igual extendían el vencimiento.

/** "$ 12.000,50" → 12000.5 ; null si no es un importe válido mayor a 0. */
export function leerImporte(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto > 0 ? texto : null;
  if (!texto) return null;
  let limpio = String(texto).replace(/\$/g, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(limpio)) return null;

  if (limpio.includes(',')) {
    // 12.000,50 → puntos = miles, coma = decimales
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    // 10.000 o 1.250.000 → miles
    limpio = limpio.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
}
