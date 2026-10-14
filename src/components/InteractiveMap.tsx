import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Comercio } from '@/types/database.types';
import { MapPin, ExternalLink, Navigation, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

// Marcador Verde para Comercios
const comercioIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Marcador Azul para TU Ubicación Actual
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Auto-centrado suave al cambiar la ubicación
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 16, { animate: true, duration: 1.2 });
  }, [center, map]);
  return null;
};

interface InteractiveMapProps {
  comercios: Comercio[];
  userLocation?: { lat: number; lng: number } | null;
}

interface ComercioConCoords extends Comercio {
  latReal?: number;
  lngReal?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ comercios, userLocation }) => {
  const centerNogoya: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng] 
    : [-32.3939, -59.7881];

  const [comerciosUbicados, setComerciosUbicados] = useState<ComercioConCoords[]>([]);

  useEffect(() => {
    const geocodificarComercios = async () => {
      const resultados = await Promise.all(
        comercios.map(async (comercio) => {
          // Si el comercio ya tiene latitud/longitud personalizadas guardadas
          if (comercio.latitud && comercio.longitud && comercio.latitud !== -32.3939) {
            return { ...comercio, latReal: comercio.latitud, lngReal: comercio.longitud };
          }

          try {
            let direccionLimpia = comercio.direccion;
            if (!direccionLimpia.toLowerCase().includes('calle')) {
              direccionLimpia = `Calle ${direccionLimpia}`;
            }

            // Búsqueda delimitada dentro de Nogoyá (Bounding Box)
            const query = encodeURIComponent(`${direccionLimpia}, Nogoyá, Entre Ríos, Argentina`);
            const viewbox = `-59.8200,-32.3700,-59.7500,-32.4200`; // Delimitación exacta Nogoyá
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${query}&viewbox=${viewbox}&bounded=1&limit=1`
            );
            const data = await res.json();

            if (data && data.length > 0) {
              return {
                ...comercio,
                latReal: parseFloat(data[0].lat),
                lngReal: parseFloat(data[0].lon)
              };
            }
          } catch (e) {
            console.error('Error al geocodificar dirección:', e);
          }

          return { ...comercio, latReal: -32.3939, lngReal: -59.7881 };
        })
      );
      setComerciosUbicados(resultados);
    };

    if (comercios.length > 0) {
      geocodificarComercios();
    }
  }, [comercios]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm relative z-0 min-h-[450px]">
      <MapContainer
        center={centerNogoya}
        zoom={15}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <RecenterMap center={centerNogoya} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* MARCADOR AZUL: TU UBICACIÓN */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="p-1 text-center space-y-1">
                <span className="font-bold text-xs text-blue-600 flex items-center justify-center gap-1">
                  <UserCheck className="w-4 h-4" /> ¡Estás acá!
                </span>
                <p className="text-[11px] text-gray-500">Tu punto actual en Nogoyá</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* MARCADORES VERDES: COMERCIOS */}
        {comerciosUbicados.map((comercio) => {
          const lat = comercio.latReal || -32.3939;
          const lng = comercio.lngReal || -59.7881;
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio.nombre},${comercio.direccion}, Nogoyá, Entre Ríos`)}`;

          return (
            <Marker key={comercio.id} position={[lat, lng]} icon={comercioIcon}>
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div className="font-bold text-sm text-gray-900">{comercio.nombre}</div>
                  <p className="text-xs text-gray-600 line-clamp-2">{comercio.descripcion_corta}</p>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" /> {comercio.direccion}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <Link
                      to={`/comercio/${comercio.slug}`}
                      className="font-bold text-green-600 hover:underline flex items-center gap-1"
                    >
                      Ver Ficha <ExternalLink className="w-3 h-3" />
                    </Link>

                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Cómo llegar
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};