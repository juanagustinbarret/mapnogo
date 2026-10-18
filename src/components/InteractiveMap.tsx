import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Comercio } from '@/types/database.types';
import { MapPin, ExternalLink, Navigation, UserCheck, LocateFixed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NOGOYA_CENTER } from '@/lib/distance';
import { visualDeRubro } from '@/lib/iconosRubro';
import { ICONO_GPS, iconoDeComercio } from '@/lib/iconosMapa';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import { coordenadasGuardadas, geocodificarDireccion } from '@/lib/geocodificacion';

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
  userLocation?: UbicacionUsuario | null;
  /** Se llama al tocar el botón de ubicación cuando todavía no hay ubicación. */
  onSolicitarUbicacion?: () => void;
  buscandoUbicacion?: boolean;
  /** Cada vez que este número cambia, el mapa vuelve a centrarse en el usuario. */
  pedidoCentrado?: number;
}

const CENTRO_POR_DEFECTO: [number, number] = [NOGOYA_CENTER.lat, NOGOYA_CENTER.lng];
const ZOOM_UBICACION = 16;
// Si el teléfono informa un error mayor, el círculo taparía media ciudad.
const PRECISION_MAXIMA_VISIBLE_M = 2000;
const ESTILO_PRECISION: L.PathOptions = {
  color: '#1a73e8',
  weight: 1,
  opacity: 0.5,
  fillColor: '#1a73e8',
  fillOpacity: 0.12,
};

const tieneCoordenadasPropias = (c: Comercio) =>
  Boolean(c.latitud && c.longitud && c.latitud !== NOGOYA_CENTER.lat);

// El listado le pasa al mapa una lista nueva en cada render (con la distancia
// recalculada cada vez que se mueve el usuario). Esta firma junta solo lo que
// el mapa muestra, para no rearmar los marcadores si eso no cambió.
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
  userLocation,
  onSolicitarUbicacion,
  buscandoUbicacion = false,
  pedidoCentrado = 0,
}) => {
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const [marcadorGps, setMarcadorGps] = useState<L.Marker | null>(null);
  const [versionGeo, setVersionGeo] = useState(0);

  // ─── Comercios y sus coordenadas ──────────────────────────────────────
  const comerciosEstables = useListaEstable(comercios, firmaDeComercios(comercios));

  const direccionesPendientes = useMemo(
    () =>
      [
        ...new Set(
          comerciosEstables
            .filter((c) => !tieneCoordenadasPropias(c) && c.direccion?.trim())
            .map((c) => c.direccion.trim()),
        ),
      ]
        .sort()
        .join('\n'),
    [comerciosEstables],
  );

  // Busca en Nominatim, de a una, las direcciones que todavía no se conocen.
  useEffect(() => {
    if (!direccionesPendientes) return;
    let vigente = true;
    void (async () => {
      for (const direccion of direccionesPendientes.split('\n')) {
        if (!vigente) return;
        if (coordenadasGuardadas(direccion) !== undefined) continue;
        await geocodificarDireccion(direccion);
        if (vigente) setVersionGeo((v) => v + 1);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [direccionesPendientes]);

  const marcadores = useMemo(
    () =>
      comerciosEstables.flatMap((comercio) => {
        let posicion: [number, number];
        if (tieneCoordenadasPropias(comercio)) {
          posicion = [comercio.latitud, comercio.longitud];
        } else {
          const encontrada = comercio.direccion?.trim() ? coordenadasGuardadas(comercio.direccion) : null;
          if (encontrada === undefined) return []; // todavía se está buscando
          // Igual que antes: si la dirección no aparece, el pin va al centro de Nogoyá.
          posicion = encontrada ? [encontrada.lat, encontrada.lng] : CENTRO_POR_DEFECTO;
        }
        return [{ comercio, posicion, visual: visualDeRubro(comercio.rubro) }];
      }),
    // versionGeo no se usa adentro: solo avisa que llegaron coordenadas nuevas.
    [comerciosEstables, versionGeo],
  );

  // ─── Ubicación del usuario, estilo GPS ────────────────────────────────
  const latUsuario = userLocation?.lat;
  const lngUsuario = userLocation?.lng;
  const posicionUsuario = useMemo<[number, number] | null>(
    () => (latUsuario !== undefined && lngUsuario !== undefined ? [latUsuario, lngUsuario] : null),
    [latUsuario, lngUsuario],
  );
  const precision = userLocation?.precision ?? null;
  const rumbo = userLocation?.rumbo ?? null;

  // "Siguiendo": el mapa acompaña al usuario mientras se mueve, hasta que él
  // mismo arrastra el mapa (como Google Maps o Waze).
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

  // Primera ubicación: se vuela hasta ahí. Después solo se acompaña si está
  // "siguiendo" (antes el mapa volvía a volar al centro en cada render).
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

  // Pedido de centrado desde afuera (botón de la tarjeta de bienvenida).
  const centrarRef = useRef<() => void>(() => undefined);
  centrarRef.current = () => {
    if (posicionUsuario) volarAlUsuario(posicionUsuario);
  };
  useEffect(() => {
    if (pedidoCentrado > 0) centrarRef.current();
  }, [pedidoCentrado]);

  // Cono de rumbo: se actualiza sobre el marcador existente para que el halo
  // no se reinicie en cada lectura del GPS.
  useEffect(() => {
    const elemento = marcadorGps?.getElement();
    if (!elemento) return;
    const hayRumbo = typeof rumbo === 'number' && Number.isFinite(rumbo);
    elemento.classList.toggle('ng-gps--con-rumbo', hayRumbo);
    if (hayRumbo) elemento.style.setProperty('--ng-rumbo', `${Math.round(rumbo)}deg`);
  }, [marcadorGps, rumbo]);

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

        {/* MARCADORES DE COMERCIOS: un ícono y un color por rubro */}
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

        {/* TU UBICACIÓN: círculo de precisión + punto azul (va arriba de los pines) */}
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

      {/* BOTÓN "MI UBICACIÓN": azul mientras el mapa te sigue */}
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
