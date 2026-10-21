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