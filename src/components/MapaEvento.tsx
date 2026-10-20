import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ICONO_EVENTO } from '@/lib/iconosMapa';
import type { PuntoMapa } from '@/lib/eventos';

// Dentro de la ficha (que entra con animación) Leaflet mide mal el tamaño
const AjustarTamano: React.FC = () => {
  const mapa = useMap();
  useEffect(() => {
    const t = setTimeout(() => mapa.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [mapa]);
  return null;
};

/** Mapa fijo y chico con el punto del evento, para la ficha. */
export const MapaEvento: React.FC<{ punto: PuntoMapa; titulo: string }> = ({ punto, titulo }) => (
  <div className="overflow-hidden rounded-2xl border border-amber-100 dark:border-gray-700" role="img" aria-label={`Mapa con la ubicación de ${titulo}`}>
    <MapContainer
      center={[punto.lat, punto.lng]}
      zoom={16}
      style={{ height: 160, width: '100%', zIndex: 0 }}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[punto.lat, punto.lng]} icon={ICONO_EVENTO} interactive={false} keyboard={false} />
      <AjustarTamano />
    </MapContainer>
  </div>
);
