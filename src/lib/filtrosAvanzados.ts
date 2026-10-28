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
  medioPago?: string;
  soloConOfertas?: boolean;
  soloMejorPuntaje?: boolean;
  soloNuevos?: boolean;
  /** Filtro de atención nocturna (20:00 hs en adelante o 24hs) */
  soloNocturno?: boolean;
}

export const PUNTAJE_MINIMO = 4;
export const RESENAS_MINIMAS = 3;
export const DIAS_NUEVO = 30;

export const tieneBuenPuntaje = (p: { puntaje: number | null; total: number } | null | undefined) =>
  !!p && p.puntaje !== null && p.total >= RESENAS_MINIMAS && p.puntaje >= PUNTAJE_MINIMO;

export const esNuevo = (creado: string | null | undefined, ahora: Date) => {
  const t = creado ? new Date(creado).getTime() : NaN;
  return Number.isFinite(t) && t <= ahora.getTime() && ahora.getTime() - t <= DIAS_NUEVO * 86_400_000;
};

/**
 * Evalúa si el comercio atiende de noche (20:00 hs en adelante o 24hs continuas).
 */
export function tieneHorarioNocturno(horarios: HorarioAtencion[]): boolean {
  if (!horarios || horarios.length === 0) return false;

  return horarios.some((h) => {
    if (!h.activo) return false;

    const apertura = String(h.hora_apertura).slice(0, 5);
    const cierre = String(h.hora_cierre).slice(0, 5);

    // Caso 24 horas continuas
    if (apertura === '00:00' && (cierre === '23:59' || cierre === '00:00')) {
      return true;
    }

    // Abre a partir de las 20:00
    if (apertura >= '20:00') {
      return true;
    }

    // Cruza la medianoche (ej. abre 19:00 y cierra a las 02:00)
    if (cierre < apertura && (apertura >= '20:00' || cierre <= '06:00')) {
      return true;
    }

    return false;
  });
}

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
    if (!c.habilitado_admin) return false;

    if (!coincideBusqueda(c, filtros.busqueda)) return false;

    if (filtros.rubroId && filtros.rubroId !== 'todos') {
      if (c.rubro_id !== filtros.rubroId) return false;
    }

    if (filtros.medioPago) {
      if (!Array.isArray(c.medios_pago)) return false;
      const coincide = c.medios_pago.some((m: string) =>
        normalizarTexto(m).includes(normalizarTexto(filtros.medioPago!))
      );
      if (!coincide) return false;
    }

    if (filtros.soloConOfertas && !c.tieneOfertas) return false;
    if (filtros.soloMejorPuntaje && !tieneBuenPuntaje(c.puntajeNogoyork)) return false;
    if (filtros.soloNuevos && !esNuevo(c.created_at, ahora)) return false;

    // 5. Filtro Nocturno (20hs+)
    if (filtros.soloNocturno && !tieneHorarioNocturno(c.horarios || [])) return false;

    // 6. Delivery
    if (filtros.soloDelivery) {
      if (!c.tiene_delivery) return false;
      if (filtros.conMomentoDelivery) {
        if (c.estadoDelivery?.estado !== 'activo') return false;
      } else if (c.delivery_pausado_hasta && new Date(c.delivery_pausado_hasta) > ahora) {
        return false;
      }
    }

    // 7. Farmacia de turno
    if (filtros.soloFarmaciasTurno) {
      if (!farmaciasTurnoIds.includes(c.id)) return false;
    }

    // 8. Abierto ahora
    if (filtros.soloAbiertos) {
      const estado: StatusHorarioResult | undefined = c.estadoAtencion;
      const abierto = estado ? estaAbierto(estado) : comercioEstaAbiertoAhora(c.horarios || [], ahora);
      if (!abierto) return false;
    }

    return true;
  });
}