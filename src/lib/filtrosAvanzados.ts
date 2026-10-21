// src/lib/filtrosAvanzados.ts
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
  conMomentoDelivery?: boolean;
  medioPago?: string; // Nuevo filtro de medio de pago
  /** Solo comercios con ofertas o novedades vigentes hoy (c.tieneOfertas) */
  soloConOfertas?: boolean;
  /** Solo los mejor puntuados en NOGOYORK (c.puntajeNogoyork) */
  soloMejorPuntaje?: boolean;
  /** Solo los que se sumaron hace poco (c.created_at) */
  soloNuevos?: boolean;
}

// "Mejor puntaje": 4 estrellas o más con al menos 3 reseñas (con una sola
// reseña de 5 estrellas no alcanza para destacarlo).
export const PUNTAJE_MINIMO = 4;
export const RESENAS_MINIMAS = 3;
// "Nuevos": se sumaron en los últimos 30 días
export const DIAS_NUEVO = 30;

export const tieneBuenPuntaje = (p: { puntaje: number | null; total: number } | null | undefined) =>
  !!p && p.puntaje !== null && p.total >= RESENAS_MINIMAS && p.puntaje >= PUNTAJE_MINIMO;

export const esNuevo = (creado: string | null | undefined, ahora: Date) => {
  const t = creado ? new Date(creado).getTime() : NaN;
  return Number.isFinite(t) && t <= ahora.getTime() && ahora.getTime() - t <= DIAS_NUEVO * 86_400_000;
};

export function comercioEstaAbiertoAhora(horarios: HorarioAtencion[], ahora: Date = new Date()): boolean {
  return estaAbierto(evaluarEstadoHorario(horarios ?? [], ahora));
}

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

    // 2. Búsqueda
    if (!coincideBusqueda(c, filtros.busqueda)) return false;

    // 3. Rubro
    if (filtros.rubroId && filtros.rubroId !== 'todos') {
      if (c.rubro_id !== filtros.rubroId) return false;
    }

    // 4. Medios de Pago (Coincidencia sobre c.medios_pago array)
    if (filtros.medioPago) {
      if (!Array.isArray(c.medios_pago)) return false;
      const coincide = c.medios_pago.some((m: string) =>
        normalizarTexto(m).includes(normalizarTexto(filtros.medioPago!))
      );
      if (!coincide) return false;
    }

    // 4b. Ofertas vigentes, mejor puntaje y nuevos
    if (filtros.soloConOfertas && !c.tieneOfertas) return false;
    if (filtros.soloMejorPuntaje && !tieneBuenPuntaje(c.puntajeNogoyork)) return false;
    if (filtros.soloNuevos && !esNuevo(c.created_at, ahora)) return false;

    // 5. Delivery
    if (filtros.soloDelivery) {
      if (!c.tiene_delivery) return false;
      if (filtros.conMomentoDelivery) {
        if (c.estadoDelivery?.estado !== 'activo') return false;
      } else if (c.delivery_pausado_hasta && new Date(c.delivery_pausado_hasta) > ahora) {
        return false;
      }
    }

    // 6. Farmacia de turno
    if (filtros.soloFarmaciasTurno) {
      if (!farmaciasTurnoIds.includes(c.id)) return false;
    }

    // 7. Abierto ahora
    if (filtros.soloAbiertos) {
      const estado: StatusHorarioResult | undefined = c.estadoAtencion;
      const abierto = estado ? estaAbierto(estado) : comercioEstaAbiertoAhora(c.horarios || [], ahora);
      if (!abierto) return false;
    }

    return true;
  });
}