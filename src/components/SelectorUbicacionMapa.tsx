import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { ICONO_EVENTO } from '@/lib/iconosMapa';
import { buscarLugar } from '@/lib/geocodificacion';
import type { PuntoMapa } from '@/lib/eventos';

const CENTRO_NOGOYA: PuntoMapa = { lat: -32.3939, lng: -59.7881 };

interface Props {
  punto: PuntoMapa | null;
  onCambiar: (punto: PuntoMapa | null) => void;
  /** Texto del campo "Lugar", para el botón "Buscar en el mapa". */
  textoLugar?: string;
  /** Cambia cuando se carga otro evento: el mapa se centra en su punto. */
  claveCentrado?: string;
}

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Toque en el mapa = marcar el punto. */
const AlTocar: React.FC<{ onTocar: (p: PuntoMapa) => void }> = ({ onTocar }) => {
  useMapEvents({
    click(e) {
      onTocar({ lat: redondear(e.latlng.lat), lng: redondear(e.latlng.lng) });
    },
  });
  return null;
};

/** Mueve la vista cuando el punto cambia desde afuera (búsqueda o editar otro evento). */
const Seguir: React.FC<{ punto: PuntoMapa | null; version: number }> = ({ punto, version }) => {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.setView([punto.lat, punto.lng], Math.max(mapa.getZoom(), 16));
    else mapa.setView([CENTRO_NOGOYA.lat, CENTRO_NOGOYA.lng], 14);
    // Solo cuando cambia "version": al tocar el mapa no hay que mover la vista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  // Dentro de un modal que se abre con animación, Leaflet calcula mal el tamaño
  useEffect(() => {
    const t = setTimeout(() => mapa.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [mapa]);
  return null;
};

/**
 * Mapa chico para marcar dónde es un evento: se toca el mapa o se arrastra el
 * pin. "Buscar en el mapa" ubica el lugar escrito para no empezar de cero.
 */
export const SelectorUbicacionMapa: React.FC<Props> = ({ punto, onCambiar, textoLugar = '', claveCentrado = '' }) => {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [version, setVersion] = useState(0);

  // Al pasar a editar otro evento, centrar el mapa en su punto
  useEffect(() => {
    setVersion((v) => v + 1);
    setAviso('');
  }, [claveCentrado]);

  const buscar = async () => {
    if (!textoLugar.trim()) {
      setAviso('Escribí primero el lugar (por ejemplo "Plaza Libertad").');
      return;
    }
    setBuscando(true);
    setAviso('');
    const encontrado = await buscarLugar(textoLugar);
    setBuscando(false);
    if (encontrado) {
      onCambiar({ lat: redondear(encontrado.lat), lng: redondear(encontrado.lng) });
      setVersion((v) => v + 1);
      setAviso('Revisá que el pin esté en el lugar exacto; si no, tocá el mapa o arrastralo.');
    } else {
      setAviso('No lo encontré. Marcalo tocando el mapa.');
    }
  };

  const centro = punto ?? CENTRO_NOGOYA;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" /> {buscando ? 'Buscando…' : 'Buscar en el mapa'}
        </button>
        {punto && (
          <button
            type="button"
            onClick={() => {
              onCambiar(null);
              setAviso('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Quitar punto
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
        <MapContainer
          center={[centro.lat, centro.lng]}
          zoom={punto ? 16 : 14}
          scrollWheelZoom={false}
          style={{ height: 240, width: '100%', zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AlTocar
            onTocar={(p) => {
              onCambiar(p);
              setAviso('');
            }}
          />
          <Seguir punto={punto} version={version} />
          {punto && (
            <Marker
              position={[punto.lat, punto.lng]}
              icon={ICONO_EVENTO}
              draggable
              keyboard={false}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onCambiar({ lat: redondear(lat), lng: redondear(lng) });
                },
              }}
            />
          )}
        </MapContainer>
        {!punto && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="inline-flex items-center gap-1 bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-gray-100 text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
              <MapPin className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" /> Tocá el mapa donde es el evento
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1" aria-live="polite">
        {punto ? (
          <>
            <LocateFixed className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            Punto marcado: {punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}
          </>
        ) : (
          'Sin punto marcado: "Cómo llegar" buscará por el nombre del lugar, que puede fallar.'
        )}
      </p>
      {aviso && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{aviso}</p>}
    </div>
  );
};
