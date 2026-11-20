import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registrarInteraccion } from '@/lib/metrics';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { PuntajePopup } from '@/components/PuntajePopup';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Comercio, Oficio, GuiaUtilItem } from '@/types/database.types';
import { MapPin, ExternalLink, Navigation, UserCheck, LocateFixed, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NOGOYA_CENTER } from '@/lib/distance';
import { visualDeRubro } from '@/lib/iconosRubro';
import { ICONO_GPS, iconoDeComercio } from '@/lib/iconosMapa';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import { posicionDeComercio, useGeocodificarComercios } from '@/lib/ubicacionComercios';

export interface UbicacionUsuario {
  lat: number;
  lng: number;
  /** Margen de error en metros que informa el teléfono (el círculo celeste). */
  precision?: number | null;
  /** Hacia dónde se mueve el usuario, en grados (0 = norte). Solo existe en movimiento. */
  rumbo?: number | null;
}

interface InteractiveMapProps {
  comercios: Comercio[];
  oficios?: Oficio[];
  guiaUtil?: GuiaUtilItem[];
  onVerFichaGuiaUtil?: (item: GuiaUtilItem) => void;
  userLocation?: UbicacionUsuario | null;
  /** Se llama al tocar el botón de ubicación cuando todavía no hay ubicación. */
  onSolicitarUbicacion?: () => void;
  buscandoUbicacion?: boolean;
  /** Cada vez que este número cambia, el mapa vuelve a centrarse en el usuario. */
  pedidoCentrado?: number;
  /** Radio del filtro de cercanía, en km: se dibuja alrededor del usuario. */
  radioKm?: number | null;
}

const CENTRO_POR_DEFECTO: [number, number] = [NOGOYA_CENTER.lat, NOGOYA_CENTER.lng];
const ZOOM_UBICACION = 16;
const PRECISION_MAXIMA_VISIBLE_M = 2000;
const ESTILO_PRECISION: L.PathOptions = {
  color: '#1a73e8',
  weight: 1,
  opacity: 0.5,
  fillColor: '#1a73e8',
  fillOpacity: 0.12,
};
const ESTILO_RADIO: L.PathOptions = {
  color: '#15803d',
  weight: 2,
  opacity: 0.8,
  dashArray: '6 6',
  fillColor: '#15803d',
  fillOpacity: 0.05,
};

const crearPinExtra = (colorBg: string, simbolo: string) =>
  L.divIcon({
    className: 'nogoyork-pin-extra',
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
      background: ${colorBg}; transform: rotate(-45deg);
      border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">${simbolo}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });

const ICONO_OFICIO = crearPinExtra('#d97706', '🔧');
const ICONO_GUIA_UTIL = crearPinExtra('#0284c7', '🏛️');
const ICONO_GUIA_URGENCIA = crearPinExtra('#e11d48', '🚨');
const ICONO_GUIA_IGLESIA = crearPinExtra('#7c3aed', '⛪');

const firmaDeComercios = (comercios: Comercio[]) =>
  comercios
    .map((c) =>
      [c.id, c.nombre, c.slug, c.direccion, c.latitud, c.longitud, c.descripcion_corta, c.rubro?.nombre, c.rubro?.icono].join('~'),
    )
    .join('|');

function useListaEstable<T>(lista: T, firma: string): T {
  const guardada = useRef({ firma, lista });
  if (guardada.current.firma !== firma) guardada.current = { firma, lista };
  return guardada.current.lista;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  comercios,
  oficios = [],
  guiaUtil = [],
  onVerFichaGuiaUtil,
  userLocation,
  onSolicitarUbicacion,
  buscandoUbicacion = false,
  pedidoCentrado = 0,
  radioKm = null,
}) => {
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const [marcadorGps, setMarcadorGps] = useState<L.Marker | null>(null);

  const comerciosEstables = useListaEstable(comercios, firmaDeComercios(comercios));
  const versionGeo = useGeocodificarComercios(comerciosEstables);

  const marcadores = useMemo(
    () =>
      comerciosEstables.flatMap((comercio) => {
        const encontrada = posicionDeComercio(comercio);
        if (encontrada === undefined) return [];
        const posicion: [number, number] = encontrada ? [encontrada.lat, encontrada.lng] : CENTRO_POR_DEFECTO;
        return [{ comercio, posicion, visual: visualDeRubro(comercio.rubro) }];
      }),
    [comerciosEstables, versionGeo],
  );

  const marcadoresOficios = useMemo(
    () =>
      oficios.filter(
        (o) =>
          typeof o.latitud === 'number' &&
          typeof o.longitud === 'number' &&
          Number.isFinite(o.latitud) &&
          Number.isFinite(o.longitud),
      ),
    [oficios],
  );

  const marcadoresGuiaUtil = useMemo(
    () =>
      guiaUtil.filter(
        (g) =>
          typeof g.latitud === 'number' &&
          typeof g.longitud === 'number' &&
          Number.isFinite(g.latitud) &&
          Number.isFinite(g.longitud),
      ),
    [guiaUtil],
  );

  const latUsuario = userLocation?.lat;
  const lngUsuario = userLocation?.lng;
  const posicionUsuario = useMemo<[number, number] | null>(
    () => (latUsuario !== undefined && lngUsuario !== undefined ? [latUsuario, lngUsuario] : null),
    [latUsuario, lngUsuario],
  );
  const precision = userLocation?.precision ?? null;
  const rumbo = userLocation?.rumbo ?? null;

  const [siguiendo, setSiguiendo] = useState(false);
  const siguiendoRef = useRef(false);
  siguiendoRef.current = siguiendo;
  const yaSeCentro = useRef(false);
  const volandoHasta = useRef(0);

  const volarAlUsuario = useCallback(
    (destino: [number, number]) => {
      if (!mapa) return;
      setSiguiendo(true);
      volandoHasta.current = Date.now() + 1300;
      mapa.flyTo(destino, Math.max(mapa.getZoom(), ZOOM_UBICACION), { duration: 1.2 });
    },
    [mapa],
  );

  useEffect(() => {
    if (!mapa) return;
    const soltar = () => setSiguiendo(false);
    mapa.on('dragstart', soltar);
    return () => {
      mapa.off('dragstart', soltar);
    };
  }, [mapa]);

  useEffect(() => {
    if (!mapa || !posicionUsuario) return;
    if (!yaSeCentro.current) {
      yaSeCentro.current = true;
      volarAlUsuario(posicionUsuario);
      return;
    }
    if (siguiendoRef.current && Date.now() > volandoHasta.current && mapa.getCenter().distanceTo(posicionUsuario) > 3) {
      mapa.panTo(posicionUsuario, { animate: true, duration: 0.5 });
    }
  }, [mapa, posicionUsuario, volarAlUsuario]);

  const centrarRef = useRef<() => void>(() => undefined);
  centrarRef.current = () => {
    if (posicionUsuario) volarAlUsuario(posicionUsuario);
  };
  useEffect(() => {
    if (pedidoCentrado > 0) centrarRef.current();
  }, [pedidoCentrado]);

  useEffect(() => {
    const elemento = marcadorGps?.getElement();
    if (!elemento) return;
    const hayRumbo = typeof rumbo === 'number' && Number.isFinite(rumbo);
    elemento.classList.toggle('ng-gps--con-rumbo', hayRumbo);
    if (hayRumbo) elemento.style.setProperty('--ng-rumbo', `${Math.round(rumbo)}deg`);
  }, [marcadorGps, rumbo]);

  const encuadrarRadioRef = useRef<() => void>(() => undefined);
  encuadrarRadioRef.current = () => {
    if (!mapa || !posicionUsuario || !radioKm) return;
    volandoHasta.current = Date.now() + 1300;
    mapa.flyToBounds(L.latLng(posicionUsuario).toBounds(radioKm * 2000), { padding: [16, 16], duration: 1 });
  };
  const hayUbicacion = posicionUsuario !== null;
  useEffect(() => {
    encuadrarRadioRef.current();
  }, [radioKm, hayUbicacion, mapa]);

  const alTocarBotonUbicacion = () => {
    if (posicionUsuario) volarAlUsuario(posicionUsuario);
    else onSolicitarUbicacion?.();
  };

  const mostrarBoton = Boolean(onSolicitarUbicacion || posicionUsuario);
  const esperandoUbicacion = buscandoUbicacion && !posicionUsuario;

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm relative z-0 min-h-[450px]">
      <MapContainer
        ref={setMapa}
        center={CENTRO_POR_DEFECTO}
        zoom={15}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* MARCADORES DE COMERCIOS */}
        {marcadores.map(({ comercio, posicion, visual }) => {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio.nombre},${comercio.direccion}, Nogoyá, Entre Ríos`)}`;

          return (
            <Marker
              key={comercio.id}
              position={posicion}
              icon={iconoDeComercio(visual)}
              title={comercio.nombre}
              riseOnHover
            >
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div>
                    <div className="font-bold text-sm text-gray-900">{comercio.nombre}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                      <InsigniaRubro rubro={comercio.rubro} />
                      {comercio.rubro?.nombre || 'Comercio'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{comercio.descripcion_corta}</p>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" /> {comercio.direccion}
                  </div>

                  <PuntajePopup comercioId={comercio.id} slug={comercio.slug} />

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
                      onClick={() => void registrarInteraccion(comercio.id, 'como_llegar')}
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

        {/* MARCADORES DE OFICIOS */}
        {marcadoresOficios.map((oficio) => {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${oficio.latitud},${oficio.longitud}`;

          return (
            <Marker
              key={`oficio-${oficio.id}`}
              position={[oficio.latitud as number, oficio.longitud as number]}
              icon={ICONO_OFICIO}
              title={`${oficio.nombre} (${oficio.oficio_rubro})`}
              riseOnHover
            >
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                      Oficio · {oficio.oficio_rubro}
                    </span>
                    <div className="font-bold text-sm text-gray-900 mt-1">{oficio.nombre}</div>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">{oficio.descripcion_corta}</p>

                  {oficio.zona_cobertura && (
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" /> {oficio.zona_cobertura}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <Link
                      to={`/oficio/${oficio.slug}`}
                      className="font-bold text-amber-700 hover:underline flex items-center gap-1"
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

        {/* MARCADORES DE GUÍA ÚTIL */}
        {marcadoresGuiaUtil.map((item) => {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`;
          const iconoItem = item.urgencia
            ? ICONO_GUIA_URGENCIA
            : item.categoria === 'Iglesias y Culto'
            ? ICONO_GUIA_IGLESIA
            : ICONO_GUIA_UTIL;

          return (
            <Marker
              key={`guia-${item.id}`}
              position={[item.latitud as number, item.longitud as number]}
              icon={iconoItem}
              title={item.nombre}
              riseOnHover
            >
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 space-y-2 min-w-[210px]">
                  <div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          item.urgencia
                            ? 'bg-rose-100 text-rose-700'
                            : item.categoria === 'Iglesias y Culto'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        Guía Útil · {item.categoria}
                      </span>
                      {(item as GuiaUtilItem & { es_24hs?: boolean }).es_24hs && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold">
                          24 HS
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-gray-900 mt-1">{item.nombre}</div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" /> {item.direccion}
                  </div>

                  {item.telefono && (
                    <a
                      href={`tel:${item.telefono}`}
                      className={`text-[11px] font-extrabold flex items-center gap-1 ${
                        item.urgencia ? 'text-rose-600' : 'text-gray-700'
                      } hover:underline`}
                    >
                      <Phone className="w-3 h-3 text-sky-600 shrink-0" /> {item.telefono}
                    </a>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs gap-2">
                    <button
                      type="button"
                      onClick={() => onVerFichaGuiaUtil?.(item)}
                      className="font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Ver Ficha <ExternalLink className="w-3 h-3" />
                    </button>

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

        {/* TU UBICACIÓN */}
        {posicionUsuario && radioKm ? (
          <Circle center={posicionUsuario} radius={radioKm * 1000} pathOptions={ESTILO_RADIO} interactive={false} />
        ) : null}
        {posicionUsuario && precision !== null && precision > 0 && precision <= PRECISION_MAXIMA_VISIBLE_M && (
          <Circle center={posicionUsuario} radius={precision} pathOptions={ESTILO_PRECISION} interactive={false} />
        )}
        {posicionUsuario && (
          <Marker
            ref={setMarcadorGps}
            position={posicionUsuario}
            icon={ICONO_GPS}
            zIndexOffset={1000}
            title="Tu ubicación"
          >
            <Popup>
              <div className="p-1 text-center space-y-1">
                <span className="font-bold text-xs text-blue-600 flex items-center justify-center gap-1">
                  <UserCheck className="w-4 h-4" /> ¡Estás acá!
                </span>
                <p className="text-[11px] text-gray-500">
                  {precision ? `Precisión aproximada: ${Math.round(precision)} m` : 'Tu punto actual en Nogoyá'}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {mostrarBoton && (
        <button
          type="button"
          onClick={alTocarBotonUbicacion}
          disabled={esperandoUbicacion}
          aria-pressed={posicionUsuario ? siguiendo : undefined}
          aria-label={posicionUsuario ? 'Centrar el mapa en mi ubicación' : 'Mostrar mi ubicación en el mapa'}
          title={posicionUsuario ? 'Centrar en mi ubicación' : 'Mostrar mi ubicación'}
          className="absolute right-3 bottom-8 z-[1000] w-11 h-11 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg flex items-center justify-center transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-wait"
        >
          <LocateFixed
            aria-hidden="true"
            className={`w-5 h-5 ${
              posicionUsuario && siguiendo ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'
            } ${esperandoUbicacion ? 'animate-pulse' : ''}`}
          />
        </button>
      )}
    </div>
  );
};
