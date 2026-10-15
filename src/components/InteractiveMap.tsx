import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Comercio } from '@/types/database.types';
import { MapPin, ExternalLink, Navigation, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NOGOYA_CENTER } from '@/lib/distance';
import { tieneCoordenadasPorDefecto } from '@/lib/geocoding';
import { registrarInteraccion } from '@/services/metricas';
import { CIUDAD, PROVINCIA } from '@/config/marca';

// Marcadores dibujados con CSS: sin imágenes externas que puedan fallar o tardar
const crearIcono = (color: string) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });

const comercioIcon = crearIcono('#16a34a');
const userIcon = crearIcono('#2563eb');

// Centra el mapa solo cuando cambian las coordenadas (no en cada render)
const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
  }, [lat, lng, map]);
  return null;
};

interface InteractiveMapProps {
  comercios: Comercio[];
  userLocation?: { lat: number; lng: number } | null;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ comercios, userLocation }) => {
  // Las coordenadas se guardan al cargar la dirección; acá no se geocodifica nada.
  const ubicados = comercios.filter(
    (c) => Number.isFinite(Number(c.latitud)) && Number.isFinite(Number(c.longitud)) && !tieneCoordenadasPorDefecto(c.latitud, c.longitud),
  );

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm relative z-0 min-h-[450px]">
      <MapContainer
        center={[NOGOYA_CENTER.lat, NOGOYA_CENTER.lng]}
        zoom={NOGOYA_CENTER.zoom}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        {userLocation && <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="p-1 text-center space-y-1">
                <span className="font-bold text-xs text-blue-600 flex items-center justify-center gap-1">
                  <UserCheck className="w-4 h-4" aria-hidden="true" /> ¡Estás acá!
                </span>
                <p className="text-[11px] text-gray-500">Tu punto actual en {CIUDAD}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {ubicados.map((comercio) => {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${comercio.nombre}, ${comercio.direccion}, ${CIUDAD}, ${PROVINCIA}`,
          )}`;

          return (
            <Marker key={comercio.id} position={[Number(comercio.latitud), Number(comercio.longitud)]} icon={comercioIcon}>
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div className="font-bold text-sm text-gray-900">{comercio.nombre}</div>
                  <p className="text-xs text-gray-600 line-clamp-2">{comercio.descripcion_corta}</p>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" aria-hidden="true" /> {comercio.direccion}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <Link to={`/comercio/${comercio.slug}`} className="font-bold text-green-600 hover:underline flex items-center gap-1">
                      Ver Ficha <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </Link>

                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void registrarInteraccion(comercio.id, 'como_llegar')}
                      className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" aria-hidden="true" /> Cómo llegar
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
