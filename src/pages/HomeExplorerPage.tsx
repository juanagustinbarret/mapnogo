import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Store, LocateFixed, Navigation, Clock, Sparkles } from 'lucide-react';
import { Comercio, Rubro, HorarioAtencion } from '@/types/database.types';
import { InteractiveMap } from '@/components/InteractiveMap';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { calcularDistanciaKm } from '@/lib/distance';
import { geocodificarDireccion, tieneCoordenadasPorDefecto } from '@/lib/geocoding';
import { listarComerciosPublicos } from '@/services/comercios';
import { listarHorariosDeComercios } from '@/services/horarios';
import { listarRubrosActivos } from '@/services/configuracion';
import { CIUDAD, PROVINCIA } from '@/config/marca';

export const HomeExplorerPage: React.FC = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioAtencion[]>>({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [soloAbiertos, setSoloAbiertos] = useState(false);

  const [userAddress, setUserAddress] = useState<string>(`${CIUDAD}, ${PROVINCIA}`);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [mostrarDireccionManual, setMostrarDireccionManual] = useState(false);
  const [direccionManual, setDireccionManual] = useState('');
  const [errorUbicacion, setErrorUbicacion] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        // Rubros y comercios en paralelo; después los horarios de esos comercios
        const [rubrosData, comerciosData] = await Promise.all([listarRubrosActivos(), listarComerciosPublicos()]);
        setRubros(rubrosData);
        setComercios(comerciosData);
        setHorarios(await listarHorariosDeComercios(comerciosData.map((c) => c.id)));
      } catch (e) {
        console.error(e);
        setErrorCarga('No pudimos cargar los comercios. Probá recargar la página.');
      } finally {
        setCargando(false);
      }
    };
    void cargar();
  }, []);

  const solicitarUbicacion = () => {
    setErrorUbicacion('');
    if (!('geolocation' in navigator)) {
      setMostrarDireccionManual(true);
      return;
    }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const calle = data.address?.road || data.address?.pedestrian || 'Tu ubicación';
          setUserAddress(`${calle}, ${CIUDAD}`);
        } catch {
          setUserAddress('Ubicación GPS detectada');
        }
        setLoadingLoc(false);
      },
      () => {
        // Sin permiso de GPS: se ofrece escribir la dirección
        setLoadingLoc(false);
        setMostrarDireccionManual(true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const buscarDireccionManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!direccionManual.trim()) return;
    setLoadingLoc(true);
    setErrorUbicacion('');
    const coords = await geocodificarDireccion(direccionManual);
    setLoadingLoc(false);
    if (coords) {
      setUserLocation(coords);
      setUserAddress(`${direccionManual.trim()}, ${CIUDAD}`);
      setMostrarDireccionManual(false);
    } else {
      setErrorUbicacion(`No encontramos esa dirección en ${CIUDAD}. Probá con calle y altura (ej: San Lorenzo 600).`);
    }
  };

  const filteredComercios = useMemo(() => {
    const texto = search.toLowerCase();
    return comercios
      .map((c) => {
        const ubicado = !tieneCoordenadasPorDefecto(c.latitud, c.longitud);
        const distancia =
          userLocation && ubicado
            ? calcularDistanciaKm(userLocation.lat, userLocation.lng, Number(c.latitud), Number(c.longitud))
            : null;
        const estadoAtencion = evaluarEstadoHorario(horarios[c.id] || []);
        return { ...c, distancia, estadoAtencion };
      })
      .filter((c) => {
        const matchSearch =
          c.nombre.toLowerCase().includes(texto) ||
          c.descripcion_corta.toLowerCase().includes(texto) ||
          c.direccion.toLowerCase().includes(texto);
        const matchRubro = selectedRubro ? c.rubro_id === selectedRubro : true;
        const matchAbierto = soloAbiertos
          ? c.estadoAtencion.estado === 'abierto' || c.estadoAtencion.estado === 'cierra_pronto'
          : true;
        return matchSearch && matchRubro && matchAbierto;
      })
      // Más cercanos primero; los que no tienen ubicación, al final
      .sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
  }, [comercios, horarios, search, selectedRubro, soloAbiertos, userLocation]);

  const colorEstado = (estado: string) =>
    estado === 'abierto'
      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
      : estado === 'cierra_pronto'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
        : estado === 'no_informado'
          ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* BIENVENIDA Y UBICACIÓN */}
      <div className="bg-gradient-to-r from-brand-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" /> Directorio Comercial
            </div>
            <h1 className="text-2xl font-black">Explorá Comercios en {CIUDAD}</h1>
            <p className="text-xs text-brand-100 flex items-center gap-1">
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" /> Ubicación: <strong className="text-white">{userAddress}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={solicitarUbicacion}
              disabled={loadingLoc}
              className="px-4 py-2.5 bg-white text-brand-700 hover:bg-brand-50 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md transition"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" /> {loadingLoc ? 'Obteniendo...' : 'Usar mi ubicación'}
            </button>
            <button
              onClick={() => setMostrarDireccionManual(!mostrarDireccionManual)}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-2xl text-xs font-bold transition"
            >
              Escribir dirección
            </button>
          </div>
        </div>

        {mostrarDireccionManual && (
          <form onSubmit={buscarDireccionManual} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="direccion-manual" className="sr-only">
              Tu dirección en {CIUDAD}
            </label>
            <input
              id="direccion-manual"
              type="text"
              value={direccionManual}
              onChange={(e) => setDireccionManual(e.target.value)}
              placeholder="Ej: San Lorenzo 600"
              className="flex-1 px-3 py-2 rounded-xl text-sm text-gray-900"
            />
            <button type="submit" disabled={loadingLoc} className="px-4 py-2 bg-white text-brand-700 rounded-xl text-xs font-bold">
              Buscar
            </button>
          </form>
        )}
        {errorUbicacion && <p className="text-xs font-semibold text-amber-200">{errorUbicacion}</p>}
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" aria-hidden="true" />
          <label htmlFor="buscar-comercio" className="sr-only">
            Buscar comercio
          </label>
          <input
            id="buscar-comercio"
            type="search"
            placeholder="Buscar por negocio o calle (ej: San Lorenzo)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 items-center">
          <button
            onClick={() => setSoloAbiertos(!soloAbiertos)}
            aria-pressed={soloAbiertos}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition flex items-center gap-1 ${
              soloAbiertos ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {soloAbiertos ? '✓ Solo Abiertos' : 'Abiertos Ahora'}
          </button>

          <button
            onClick={() => setSelectedRubro('')}
            aria-pressed={selectedRubro === ''}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
              selectedRubro === '' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Todos
          </button>

          {rubros.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRubro(r.id)}
              aria-pressed={selectedRubro === r.id}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
                selectedRubro === r.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {r.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* MAPA Y LISTADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[600px]">
        <div className="lg:col-span-2 h-[420px] lg:h-full">
          <InteractiveMap comercios={filteredComercios} userLocation={userLocation} />
        </div>

        <div className="overflow-y-auto space-y-3 pr-1 max-h-[600px]">
          {cargando ? (
            <div className="text-center py-12 text-gray-500 text-sm font-semibold">Cargando comercios...</div>
          ) : errorCarga ? (
            <div className="text-center py-12 text-red-600 text-sm font-semibold">{errorCarga}</div>
          ) : filteredComercios.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Store className="w-10 h-10 mx-auto opacity-40" aria-hidden="true" />
              <p className="text-sm font-semibold">No se encontraron negocios con esos filtros</p>
            </div>
          ) : (
            filteredComercios.map((comercio) => (
              <div
                key={comercio.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-500 transition space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{comercio.nombre}</h3>
                    <span className="text-[11px] font-bold text-brand-600">{comercio.rubro?.nombre}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorEstado(comercio.estadoAtencion.estado)}`}>
                      {comercio.estadoAtencion.mensaje}
                    </span>
                    {comercio.distancia !== null && (
                      <span className="text-[10px] font-bold text-gray-400 font-mono">a {comercio.distancia} km</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{comercio.descripcion_corta}</p>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t dark:border-gray-700">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" aria-hidden="true" /> {comercio.direccion}
                  </span>
                  <Link to={`/comercio/${comercio.slug}`} className="text-brand-600 font-bold hover:underline shrink-0">
                    Ver Ficha →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
