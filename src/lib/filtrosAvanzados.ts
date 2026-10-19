import { Comercio, HorarioAtencion } from '@/types/database.types';

export interface FiltrosMapa {
  busqueda: string;
  rubroId: string;
  soloAbiertos: boolean;
  soloDelivery: boolean;
  soloFarmaciasTurno: boolean;
}

export function comercioEstaAbiertoAhora(horarios: HorarioAtencion[]): boolean {
  if (!horarios || horarios.length === 0) return false;

  const ahora = new Date();
  // Convierte 0 (Domingo en JS) a 6, y 1..6 a 0..5 (Lunes a Domingo)
  const diaSemanaIndex = (ahora.getDay() + 6) % 7; 
  const horaActualStr = ahora.toTimeString().slice(0, 5); // "14:30"

  const turnosHoy = horarios.filter(
    (h) => Number(h.dia_semana) === diaSemanaIndex && h.activo
  );

  return turnosHoy.some((t) => {
    return horaActualStr >= t.hora_apertura && horaActualStr <= t.hora_cierre;
  });
}

export function filtrarComerciosMapa(
  comercios: any[],
  filtros: FiltrosMapa,
  farmaciasTurnoIds: string[] = []
) {
  return comercios.filter((c) => {
    // 1. Visibilidad básica
    if (!c.habilitado_admin) return false;

    // 2. Búsqueda por palabra clave (Nombre, Dirección, Servicios)
    if (filtros.busqueda.trim() !== '') {
      const q = filtros.busqueda.toLowerCase();
      const coincideNombre = c.nombre.toLowerCase().includes(q);
      const coincideDireccion = c.direccion?.toLowerCase().includes(q);
      const coincideServicio = c.servicios?.some((s: string) => s.toLowerCase().includes(q));

      if (!coincideNombre && !coincideDireccion && !coincideServicio) return false;
    }

    // 3. Rubro
    if (filtros.rubroId && filtros.rubroId !== 'todos') {
      if (c.rubro_id !== filtros.rubroId) return false;
    }

    // 4. Delivery
    if (filtros.soloDelivery) {
      if (!c.tiene_delivery) return false;
      if (c.delivery_pausado_hasta && new Date(c.delivery_pausado_hasta) > new Date()) return false;
    }

    // 5. Farmacia de turno
    if (filtros.soloFarmaciasTurno) {
      if (!farmaciasTurnoIds.includes(c.id)) return false;
    }

    // 6. Abierto ahora
    if (filtros.soloAbiertos) {
      if (!comercioEstaAbiertoAhora(c.horarios || [])) return false;
    }

    return true;
  });
}
