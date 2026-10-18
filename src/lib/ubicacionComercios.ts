// src/lib/ubicacionComercios.ts
//
// Dónde está cada comercio. Lo usan el mapa (para poner el pin) y el listado
// (para calcular la distancia y filtrar por radio), así los dos usan siempre
// las mismas coordenadas.
//
//   1. Si el comercio tiene latitud/longitud propias en la base, se usan esas.
//   2. Si no (quedaron vacías o con el centro de Nogoyá que trae por defecto el
//      formulario del admin), se busca su dirección en Nominatim.

import { useEffect, useMemo, useState } from 'react';
import { Comercio } from '@/types/database.types';
import { NOGOYA_CENTER } from '@/lib/distance';
import { coordenadasGuardadas, geocodificarDireccion, type Coordenadas } from '@/lib/geocodificacion';

type ConUbicacion = Pick<Comercio, 'latitud' | 'longitud' | 'direccion'>;

export const tieneCoordenadasPropias = (c: ConUbicacion) =>
  Boolean(
    Number.isFinite(Number(c.latitud)) &&
      Number.isFinite(Number(c.longitud)) &&
      Number(c.latitud) !== 0 &&
      Number(c.longitud) !== 0 &&
      // El formulario del admin arranca con el centro de Nogoyá: si nadie movió
      // el pin, esas coordenadas no dicen dónde está el comercio.
      !(Number(c.latitud) === NOGOYA_CENTER.lat && Number(c.longitud) === NOGOYA_CENTER.lng),
  );

/**
 * Coordenadas del comercio.
 * `undefined` = todavía se está buscando la dirección; `null` = no se pudo ubicar.
 */
export function posicionDeComercio(c: ConUbicacion): Coordenadas | null | undefined {
  if (tieneCoordenadasPropias(c)) return { lat: Number(c.latitud), lng: Number(c.longitud) };
  if (!c.direccion?.trim()) return null;
  return coordenadasGuardadas(c.direccion);
}

/**
 * Busca en Nominatim (de a una por segundo) las direcciones de los comercios
 * que no tienen coordenadas propias. Devuelve un número que cambia cada vez
 * que llega una ubicación nueva, para que el componente se vuelva a dibujar.
 */
export function useGeocodificarComercios(comercios: ConUbicacion[]): number {
  const [version, setVersion] = useState(0);

  // Texto estable: la lista cambia de referencia en cada render, las direcciones no.
  const pendientes = useMemo(
    () =>
      [
        ...new Set(
          comercios.filter((c) => !tieneCoordenadasPropias(c) && c.direccion?.trim()).map((c) => c.direccion.trim()),
        ),
      ]
        .sort()
        .join('\n'),
    [comercios],
  );

  useEffect(() => {
    if (!pendientes) return;
    let vigente = true;
    void (async () => {
      for (const direccion of pendientes.split('\n')) {
        if (!vigente) return;
        if (coordenadasGuardadas(direccion) !== undefined) continue;
        await geocodificarDireccion(direccion);
        if (vigente) setVersion((v) => v + 1);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [pendientes]);

  return version;
}
