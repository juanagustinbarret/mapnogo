import type { HorarioAtencion } from '@/types/database.types';
import { evaluarEstadoHorario, estaAbierto, type StatusHorarioResult } from '@/lib/scheduleEvaluator';
import { categoriaDeRubro } from '@/lib/catalogoRubros';
import { normalizarTexto } from '@/lib/filtrosComercios';

export interface FiltrosMapa {
  busqueda: string;
  rubroId: string;
  soloAbiertos: boolean;
  soloDelivery: boolean;
  soloFarmaciasTurno: boolean;
}

/**
 * ¿Está abierto ahora? Misma regla que la etiqueta de la tarjeta
 * (evaluarEstadoHorario): hora de Argentina, turnos que cruzan la medianoche
 * y "cierra pronto" cuenta como abierto.
 *
 * Antes se usaba la hora del dispositivo y se comparaban textos
 * ("23:00" >= "20:00:00" && "23:00" <= "02:00:00"): un turno de 20:00 a 02:00
 * nunca figuraba abierto y la tarjeta decía "Abierto" mientras el filtro lo
 * escondía.
 */
export function comercioEstaAbiertoAhora(horarios: HorarioAtencion[], ahora: Date = new Date()): boolean {
  return estaAbierto(evaluarEstadoHorario(horarios ?? [], ahora));
}

/** Busca sin importar tildes ni mayúsculas, también por rubro y categoría. */
export function coincideBusqueda(c: any, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim());
  if (!termino) return true;
  const campos: Array<string | null | undefined> = [
    c.nombre,
    c.direccion,
    c.descripcion_corta,
    c.rubro?.nombre,
    c.rubro ? categoriaDeRubro(c.rubro) : '',
    ...(Array.isArray(c.servicios) ? c.servicios : []),
  ];
  return campos.some((campo) => typeof campo === 'string' && normalizarTexto(campo).includes(termino));
}

export function filtrarComerciosMapa(
  comercios: any[],
  filtros: FiltrosMapa,
  farmaciasTurnoIds: string[] = [],
  ahora: Date = new Date()
) {
  return comercios.filter((c) => {
    // 1. Visibilidad básica
    if (!c.habilitado_admin) return false;

    // 2. Búsqueda (nombre, dirección, descripción, rubro, categoría, servicios)
    if (!coincideBusqueda(c, filtros.busqueda)) return false;

    // 3. Rubro
    if (filtros.rubroId && filtros.rubroId !== 'todos') {
      if (c.rubro_id !== filtros.rubroId) return false;
    }

    // 4. Delivery
    if (filtros.soloDelivery) {
      if (!c.tiene_delivery) return false;
      if (c.delivery_pausado_hasta && new Date(c.delivery_pausado_hasta) > ahora) return false;
    }

    // 5. Farmacia de turno
    if (filtros.soloFarmaciasTurno) {
      if (!farmaciasTurnoIds.includes(c.id)) return false;
    }

    // 6. Abierto ahora (si ya viene evaluado, se usa ese mismo estado)
    if (filtros.soloAbiertos) {
      const estado: StatusHorarioResult | undefined = c.estadoAtencion;
      const abierto = estado ? estaAbierto(estado) : comercioEstaAbiertoAhora(c.horarios || [], ahora);
      if (!abierto) return false;
    }

    return true;
  });
}
