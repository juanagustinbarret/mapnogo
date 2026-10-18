// src/lib/filtrosComercios.ts
//
// Filtros y orden del listado principal, como función pura para poder
// combinarlos y probarlos: búsqueda, rubro, "Abiertos Ahora", "Delivery
// activo", radio de cercanía y orden. Se filtra en el navegador, igual que
// "Abiertos Ahora" (los horarios ya se cargan todos al entrar).

import { categoriaDeRubro } from './catalogoRubros';
import type { EstadoDelivery } from './delivery';

export interface ComercioEvaluado {
  id: string;
  nombre: string;
  descripcion_corta?: string | null;
  direccion?: string | null;
  rubro_id?: string;
  rubro?: { nombre?: string | null; slug?: string | null } | null;
  distancia: number | null;
  estadoAtencion: { estado: string };
  estadoDelivery: EstadoDelivery;
}

export interface OpcionesFiltro {
  busqueda: string;
  rubroId: string;
  soloAbiertos: boolean;
  soloDelivery: boolean;
  radioKm: number | null; // null = sin radio (o sin ubicación del usuario)
  ordenamiento: 'cercania' | 'nombre';
}

export const normalizarTexto = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarComercios<T extends ComercioEvaluado>(lista: T[], o: OpcionesFiltro): T[] {
  const termino = normalizarTexto(o.busqueda.trim());
  return lista
    .filter((c) => {
      // Busca también por rubro y categoría, sin importar tildes ni mayúsculas
      const coincideBusqueda =
        !termino ||
        [c.nombre, c.descripcion_corta, c.direccion, c.rubro?.nombre, c.rubro ? categoriaDeRubro(c.rubro) : '']
          .some((campo) => campo && normalizarTexto(campo).includes(termino));
      const coincideRubro = o.rubroId ? c.rubro_id === o.rubroId : true;
      // "cierra_pronto" también está abierto
      const coincideAbierto = o.soloAbiertos ? ['abierto', 'cierra_pronto'].includes(c.estadoAtencion.estado) : true;
      const coincideDelivery = o.soloDelivery ? c.estadoDelivery.estado === 'activo' : true;
      // Los comercios que no se pudieron ubicar quedan afuera del radio
      const coincideRadio = o.radioKm !== null ? c.distancia !== null && c.distancia <= o.radioKm : true;
      return coincideBusqueda && coincideRubro && coincideAbierto && coincideDelivery && coincideRadio;
    })
    .sort((a, b) => {
      if (o.ordenamiento === 'cercania') {
        if (a.distancia !== null && b.distancia !== null) return a.distancia - b.distancia;
        if (a.distancia !== null) return -1;
        if (b.distancia !== null) return 1;
      }
      return a.nombre.localeCompare(b.nombre, 'es');
    });
}
