// src/lib/mensajeMetricas.ts
//
// Texto del mensaje de métricas que el admin le manda a cada comercio por
// WhatsApp. Función pura: no envía nada, solo arma el texto (se muestra una
// vista previa antes de abrir WhatsApp).

import { describirRango, type RangoFechas } from './rangosFechas';
import { PLANTILLAS_PREDETERMINADAS, completarPlantilla } from './plantillasMensajes';

export interface ValoresMetricas {
  visitas: number;
  whatsapp: number;
  comoLlegar: number;
}

/** 1234 → "1.234" (formato argentino). */
export const formatearNumero = (n: number) => new Intl.NumberFormat('es-AR').format(n);

/** Comparación con el período anterior: "▲ 12 %", "▼ 3 %", "= igual" o "nuevo". */
export function variacion(actual: number, anterior: number | undefined): string {
  if (anterior === undefined) return '';
  if (actual === anterior) return '= igual';
  if (anterior === 0) return 'antes: 0';
  const porcentaje = Math.round(((actual - anterior) / anterior) * 100);
  if (porcentaje === 0) return actual > anterior ? '▲ menos de 1 %' : '▼ menos de 1 %';
  return `${porcentaje > 0 ? '▲' : '▼'} ${Math.abs(porcentaje)} %`;
}

export const DEFINICIONES_METRICAS: Array<{ clave: keyof ValoresMetricas; emoji: string; singular: string; plural: string }> = [
  { clave: 'visitas', emoji: '👀', singular: 'visita a tu ficha', plural: 'visitas a tu ficha' },
  { clave: 'whatsapp', emoji: '💬', singular: 'consulta por WhatsApp', plural: 'consultas por WhatsApp' },
  { clave: 'comoLlegar', emoji: '📍', singular: 'pedido de "Cómo llegar"', plural: 'pedidos de "Cómo llegar"' },
];

/** Las tres líneas de números, con la comparación entre paréntesis. */
export function resumenMetricas(actual: ValoresMetricas, anterior?: ValoresMetricas): string {
  return DEFINICIONES_METRICAS.map(({ clave, emoji, singular, plural }) => {
    const valor = actual[clave];
    const comparacion = variacion(valor, anterior?.[clave]);
    return `${emoji} *${formatearNumero(valor)}* ${valor === 1 ? singular : plural}${comparacion ? ` (${comparacion})` : ''}`;
  }).join('\n');
}

/** Valores de las variables del mensaje de métricas ({periodo}, {visitas}...). */
export function valoresMensajeMetricas(datos: {
  nombreComercio: string;
  rango: RangoFechas;
  actual: ValoresMetricas;
  anterior?: ValoresMetricas;
  urlDetalle?: string;
}): Record<string, string | undefined> {
  return {
    nombre_comercio: datos.nombreComercio,
    periodo: describirRango(datos.rango),
    resumen_metricas: resumenMetricas(datos.actual, datos.anterior),
    visitas: formatearNumero(datos.actual.visitas),
    consultas_whatsapp: formatearNumero(datos.actual.whatsapp),
    como_llegar: formatearNumero(datos.actual.comoLlegar),
    link_panel: datos.urlDetalle,
  };
}

/** Mensaje de métricas armado con la plantilla (la guardada o la predeterminada). */
export function armarMensajeMetricas(
  datos: Parameters<typeof valoresMensajeMetricas>[0],
  plantilla: string = PLANTILLAS_PREDETERMINADAS.metricas,
): { texto: string; faltantes: string[] } {
  return completarPlantilla(plantilla, valoresMensajeMetricas(datos));
}

/** Link al panel del comercio con el mismo período elegido. */
export const urlDetalleMetricas = (origen: string, rango: RangoFechas) =>
  `${origen.replace(/\/$/, '')}/panel?desde=${rango.desde}&hasta=${rango.hasta}`;
