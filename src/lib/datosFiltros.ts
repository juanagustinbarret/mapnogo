// src/lib/datosFiltros.ts
//
// Datos extra para los filtros del inicio "Con ofertas" y "Mejor puntaje".
// Se piden recién cuando la persona activa el filtro (no suman nada a la
// carga del inicio) y una sola vez por visita.

import { supabase } from './supabase';
import { hoyArgentina } from './fechasArgentina';
import { calcularPuntaje, type PuntajePropio } from './puntajePropio';

/** Ids de los comercios con alguna oferta o novedad vigente hoy. */
export async function pedirComerciosConOfertas(): Promise<Set<string>> {
  const hoy = hoyArgentina();
  const { data, error } = await supabase
    .from('promociones')
    .select('comercio_id')
    .eq('aprobada', true)
    .lte('fecha_inicio', hoy)
    .gte('fecha_fin', hoy);
  if (error) throw error;
  return new Set((data ?? []).map((f: { comercio_id: string }) => f.comercio_id));
}

/** Puntaje de NOGOYORK de cada comercio, a partir de las reseñas (de a 1000 filas). */
export async function pedirPuntajes(): Promise<Record<string, PuntajePropio>> {
  const porComercio: Record<string, number[]> = {};
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase.from('resenas').select('comercio_id, estrellas').order('id').range(desde, desde + pagina - 1);
    if (error) throw error;
    for (const f of (data ?? []) as { comercio_id: string; estrellas: number }[]) (porComercio[f.comercio_id] ??= []).push(f.estrellas);
    if (!data || data.length < pagina) break;
  }
  return Object.fromEntries(Object.entries(porComercio).map(([id, estrellas]) => [id, calcularPuntaje(estrellas)]));
}
