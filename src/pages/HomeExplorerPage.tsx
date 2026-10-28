import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Rubro, HorarioAtencion } from '@/types/database.types';
import type { UbicacionUsuario } from '@/components/InteractiveMap';
import { GuiaUtilModal } from '@/components/GuiaUtilModal';
import { WidgetClima } from '@/components/WidgetClima';
import { MarquesinaAvisos } from '@/components/MarquesinaAvisos';
import { SmartSearch } from '@/components/SmartSearch';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { pedirComerciosConOfertas, pedirPuntajes } from '@/lib/datosFiltros';

const InteractiveMap = lazy(() => import('@/components/InteractiveMap').then((m) => ({ default: m.InteractiveMap })));
import { formatearPuntaje } from '@/lib/puntaje';
import type { PuntajePropio } from '@/lib/puntajePropio';
import { MapPin, Store, LocateFixed, Navigation, Clock, Sparkles, CheckCircle2, SlidersHorizontal, Bike, HeartPulse, MessageCircle, ArrowRight, Banknote, Building2, Tag, Star, Moon, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import {
  estadoDeliveryDelComercio,
  momentoArgentina,
  textoEstadoDelivery,
  textoMomentoElegido,
  type MomentoElegido,
  type RangoDelivery,
} from '@/lib/delivery';
import { FiltroDeliveryBotonPrincipal, FiltroDeliveryBotonConsulta } from '@/components/FiltroDelivery';
import { calleEnCoordenadas } from '@/lib/geocodificacion';
import { posicionDeComercio, useGeocodificarComercios } from '@/lib/ubicacionComercios';
import { hoyArgentina } from '@/lib/fechasArgentina';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { filtrarComerciosMapa, esNuevo, DIAS_NUEVO, PUNTAJE_MINIMO, RESENAS_MINIMAS, type FiltrosMapa } from '@/lib/filtrosAvanzados';

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function formatearDistanciaTexto(distanciaKm: number | null): string {
  if (distanciaKm === null) return '';
  if (distanciaKm < 1) {
    return `a ${Math.round(distanciaKm * 1000)} m`;
  }
  return `a ${distanciaKm.toFixed(1)} km`;
}

export const HomeExplorerPage: React.FC = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loadingComercios, setLoadingComercios] = useState(true);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioAtencion[]>>({});
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [medioPago, setMedioPago] = useState<string>('');
  
  const [soloConOfertas, setSoloConOfertas] = useState(false);
  const [soloMejorPuntaje, setSoloMejorPuntaje] = useState(false);
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [soloNocturno, setSoloNocturno] = useState(false);
  const [conOfertas, setConOfertas] = useState<Set<string> | null>(null);
  const [puntajes, setPuntajes] = useState<Record<string, PuntajePropio> | null>(null);
  const [cargandoExtra, setCargandoExtra] = useState<'ofertas' | 'puntaje' | null>(null);
  const [errorExtra, setErrorExtra] = useState('');
  
  const [farmaciaDeTurno, setFarmaciaDeTurno] = useState<Comercio | null>(null);
  const [modalGuiaUtilOpen, setModalGuiaUtilOpen] = useState(false);

  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [soloDelivery, setSoloDelivery] = useState(false);
  const [momentoDelivery, setMomentoDelivery] = useState<MomentoElegido | null>(null);
  const [soloFarmaciasTurno, setSoloFarmaciasTurno] = useState(false);

  const [delivery, setDelivery] = useState<Record<string, RangoDelivery[]>>({});

  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const reloj = window.setInterval(actualizar, 60_000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', actualizar);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', actualizar);
    };
  }, []);

  const [radioKm, setRadioKm] = useState<number | null>(null);
  const [ordenamiento, setOrdenamiento] = useState<'cercania' | 'nombre'>('cercania');
  
  const [userAddress, setUserAddress] = useState<string>('Nogoyá, Entre Ríos');
  const [userLocation, setUserLocation] = useState<UbicacionUsuario | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [pedidoCentrado, setPedidoCentrado] = useState(0);
  const seguimientoId = useRef<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const detenerSeguimiento = useCallback(() => {
    if (seguimientoId.current !== null) {
      navigator.geolocation.clearWatch(seguimientoId.current);
      seguimientoId.current = null;
    }
  }, []);

  useEffect(() => detenerSeguimiento, [detenerSeguimiento]);

  const fetchData = async () => {
    setLoadingComercios(true);
    const { data: rubrosData } = await supabase.from('rubros').select('*').eq('estado', true).order('orden');
    const pedirComercios = (columnas: string) =>
      supabase
        .from('comercios')
        .select(`${columnas}, rubro:rubros(*)` as '*')
        .eq('aprobado', true)
        .eq('habilitado_admin', true);
    let { data: comerciosData, error: errorComercios } = await pedirComercios(COLUMNAS_LISTADO_COMERCIO);
    if (errorComercios) ({ data: comerciosData } = await pedirComercios('*'));

    const { data: horariosData } = await supabase.from('horarios_atencion').select('*');

    const fechaHoy = hoyArgentina();
    const pedirTurno = (columnas: string) =>
      supabase
        .from('farmacias_turno')
        .select(`comercio_id, comercio:comercios(${columnas}, rubro:rubros(*))` as '*')
        .eq('fecha', fechaHoy)
        .maybeSingle();
    let { data: turnoData, error: errorTurno } = await pedirTurno(COLUMNAS_LISTADO_COMERCIO);
    if (errorTurno) ({ data: turnoData } = await pedirTurno('*'));

    if (turnoData?.comercio) {
      setFarmaciaDeTurno(turnoData.comercio as unknown as Comercio);
    }

    const { data: deliveryData, error: errorDelivery } = await supabase
      .from('horarios_delivery')
      .select('comercio_id, dia_semana, hora_inicio, hora_fin');
    if (errorDelivery) console.warn('[delivery] No se pudieron leer los horarios de delivery:', errorDelivery.message);
    if (deliveryData) {
      const mapaDelivery: Record<string, RangoDelivery[]> = {};
      deliveryData.forEach((d) => {
        (mapaDelivery[d.comercio_id] ??= []).push(d);
      });
      setDelivery(mapaDelivery);
    }

    if (rubrosData) setRubros(rubrosData);
    if (comerciosData) setComercios(comerciosData);

    if (horariosData) {
      const mapaHorarios: Record<string, HorarioAtencion[]> = {};
      horariosData.forEach((h) => {
        if (!mapaHorarios[h.comercio_id]) mapaHorarios[h.comercio_id] = [];
        mapaHorarios[h.comercio_id].push(h);
      });
      setHorarios(mapaHorarios);
    }
    setLoadingComercios(false);
  };

  const solicitarUbicacion = () => {
    if (!('geolocation' in navigator)) {
      alert('La geolocalización no está soportada en este navegador.');
      return;
    }
    if (seguimientoId.current !== null) {
      if (userLocation) setPedidoCentrado((n) => n + 1);
      return;
    }

    setLoadingLoc(true);
    let tuvoUbicacion = false;

    seguimientoId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
        setUserLocation({
          lat,
          lng,
          precision: Number.isFinite(accuracy) ? accuracy : null,
          rumbo: heading !== null && Number.isFinite(heading) ? heading : null,
        });
        setLoadingLoc(false);

        if (!tuvoUbicacion) {
          tuvoUbicacion = true;
          calleEnCoordenadas(lat, lng)
            .then((calle) => setUserAddress(`${calle || 'Tu ubicación'}, Nogoyá`))
            .catch(() => setUserAddress('Ubicación GPS detectada'));
        }
      },
      (error) => {
        if (tuvoUbicacion && error.code !== error.PERMISSION_DENIED) return;

        detenerSeguimiento();
        setLoadingLoc(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('Permiso denegado. Si usás iPhone, andá a Ajustes > Privacidad > Localización y asegurate de dar permiso a Safari/navegador.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('Ubicación no disponible en este momento.');
            break;
          case error.TIMEOUT:
            alert('Se agotó el tiempo de espera para obtener la ubicación.');
            break;
          default:
            alert('No se pudo obtener la geolocalización automática.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );
  };

  useGeocodificarComercios(comercios);

  const filtrarPorRadio = radioKm !== null && userLocation !== null;

  const elegirRadio = (valor: number | null) => {
    setRadioKm(valor);
    if (valor !== null && !userLocation && !loadingLoc) solicitarUbicacion();
  };

  const rubrosEnUso = rubros.filter(
    (r) => r.id === selectedRubro || comercios.some((c) => c.rubro_id === r.id),
  );

  const momentoAhora = momentoArgentina(ahora);

  const filtrosActuales: FiltrosMapa = {
    busqueda: search,
    rubroId: selectedRubro,
    soloAbiertos,
    soloDelivery,
    soloFarmaciasTurno,
    conMomentoDelivery: momentoDelivery !== null,
    medioPago,
    soloConOfertas: soloConOfertas && conOfertas !== null,
    soloMejorPuntaje: soloMejorPuntaje && puntajes !== null,
    soloNuevos,
    soloNocturno,
  };

  const activarOfertas = async () => {
    const nuevo = !soloConOfertas;
    setSoloConOfertas(nuevo);
    if (!nuevo || conOfertas) return;
    setCargandoExtra('ofertas');
    setErrorExtra('');
    try {
      setConOfertas(await pedirComerciosConOfertas());
    } catch {
      setSoloConOfertas(false);
      setErrorExtra('No se pudieron cargar las ofertas. Probá de nuevo.');
    } finally {
      setCargandoExtra(null);
    }
  };

  const activarPuntaje = async () => {
    const nuevo = !soloMejorPuntaje;
    setSoloMejorPuntaje(nuevo);
    if (!nuevo || puntajes) return;
    setCargandoExtra('puntaje');
    setErrorExtra('');
    try {
      setPuntajes(await pedirPuntajes());
    } catch {
      setSoloMejorPuntaje(false);
      setErrorExtra('No se pudieron cargar los puntajes. Probá de nuevo.');
    } finally {
      setCargandoExtra(null);
    }
  };

  const farmaciasTurnoIds = farmaciaDeTurno ? [farmaciaDeTurno.id] : [];
  const whatsappFarmacia = normalizeWhatsAppNumber(farmaciaDeTurno?.whatsapp ?? '');

  const comerciosProcesados = comercios.map((c) => {
    const posicion = posicionDeComercio(c);
    const distancia =
      userLocation && posicion
        ? calcularDistanciaKm(userLocation.lat, userLocation.lng, posicion.lat, posicion.lng)
        : null;
    const estadoAtencion = evaluarEstadoHorario(horarios[c.id] || [], ahora);
    const estadoDelivery = estadoDeliveryDelComercio(c, delivery[c.id], horarios[c.id], momentoDelivery?.instante ?? ahora);
    return {
      ...c,
      distancia,
      estadoAtencion,
      estadoDelivery,
      horarios: horarios[c.id] || [],
      tieneOfertas: conOfertas?.has(c.id) ?? false,
      puntajeNogoyork: puntajes?.[c.id] ?? null,
    };
  });

  const mostrarInsigniaNuevo = comercios.filter((c) => esNuevo(c.created_at, ahora)).length <= comercios.length / 2;

  const filteredComercios = filtrarComerciosMapa(comerciosProcesados, filtrosActuales, farmaciasTurnoIds, ahora)
    .filter((c) => {
      if (filtrarPorRadio && radioKm !== null) {
        if (c.distancia === null || c.distancia > radioKm) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenamiento === 'cercania') {
        if (a.distancia !== null && b.distancia !== null) {
          return a.distancia - b.distancia;
        }
        if (a.distancia !== null) return -1;
        if (b.distancia !== null) return 1;
      }
      return a.nombre.localeCompare(b.nombre);
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-300">
      
      <GuiaUtilModal
        isOpen={modalGuiaUtilOpen}
        onClose={() => setModalGuiaUtilOpen(false)}
      />

      <MarquesinaAvisos />
      
      {farmaciaDeTurno && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-blue-700 rounded-3xl p-4 sm:p-5 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-rose-400/30">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md text-white shrink-0 shadow-inner">
              <HeartPulse className="w-7 h-7 animate-pulse text-rose-200" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md text-rose-100">
                🏥 Farmacia de Turno Hoy en Nogoyá
              </div>
              <h2 className="text-lg sm:text-xl font-black mt-0.5">
                {farmaciaDeTurno.nombre}
              </h2>
              <p className="text-xs text-rose-100 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-200" /> {farmaciaDeTurno.direccion || 'Nogoyá, Entre Ríos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/20">
            {whatsappFarmacia.isValid && (
              <a
                href={buildWhatsAppUrl(whatsappFarmacia.normalized, '')}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}

            <Link
              to={`/comercio/${farmaciaDeTurno.slug}`}
              className="flex-1 sm:flex-none px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md transition"
            >
              Ver Ficha <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* BANNER PRINCIPAL */}
      <div className="bg-gradient-to-r from-brand-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Directorio Comercial Inteligente
            </div>
          </div>

          <div className="py-0.5">
            <WidgetClima />
          </div>

          <h1 className="text-2xl font-black">Explorá Comercios en Nogoyá</h1>
          <p className="text-xs text-brand-100 flex items-center gap-1">
            <LocateFixed className="w-3.5 h-3.5" /> Ubicación: <strong className="text-white">{userAddress}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={() => setModalGuiaUtilOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition active:scale-95 border border-sky-400/30"
          >
            <Info className="w-4 h-4" /> Guía Útil
          </button>

          <button
            onClick={solicitarUbicacion}
            disabled={loadingLoc}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-brand-700 hover:bg-brand-50 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition shrink-0"
          >
            <Navigation className="w-4 h-4" />{' '}
            {loadingLoc ? 'Obteniendo...' : userLocation ? 'Centrar Mi Ubicación' : 'Usar Mi Ubicación'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 pt-4 pb-3 space-y-3">
        {/* BUSCADOR INTELIGENTE EN VIVO */}
        <div className="px-4">
          <SmartSearch
            comercios={comercios}
            rubros={rubros}
            searchQuery={search}
            onSearchChange={setSearch}
            onSelectRubro={setSelectedRubro}
          />
        </div>

        <div className="px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-gray-500 font-bold px-1.5 flex items-center gap-1 text-[11px] shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Radio:
            </span>
            {[
              { label: 'Todo', val: null },
              { label: '500m', val: 0.5 },
              { label: '1km', val: 1 },
              { label: '3km', val: 3 },
              { label: '5km', val: 5 },
            ].map((r) => (
              <button
                key={r.label}
                onClick={() => elegirRadio(r.val)}
                className={`px-2 py-1 rounded-lg font-bold transition text-[11px] shrink-0 ${
                  radioKm === r.val
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <select
            value={ordenamiento}
            onChange={(e) => {
              const valor = e.target.value as 'cercania' | 'nombre';
              setOrdenamiento(valor);
              if (valor === 'cercania' && !userLocation && !loadingLoc) solicitarUbicacion();
            }}
            className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 font-bold text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none shrink-0"
          >
            <option value="cercania">Ordenar por Cercanía</option>
            <option value="nombre">Ordenar por Nombre</option>
          </select>
        </div>

        {!userLocation && (radioKm !== null || ordenamiento === 'cercania') && (
          <p className="px-4 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1" role="status">
            <LocateFixed className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {loadingLoc ? (
              'Buscando tu ubicación para medir las distancias...'
            ) : (
              <>
                Para filtrar y ordenar por cercanía necesitamos tu ubicación.
                <button onClick={solicitarUbicacion} className="font-bold text-brand-600 hover:underline">
                  Activarla
                </button>
              </>
            )}
          </p>
        )}

        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 w-full space-y-2.5">
          <div className="px-4 space-y-2">
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSoloAbiertos(!soloAbiertos)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  soloAbiertos
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Abierto Ahora
              </button>

              <button
                onClick={() => setSoloNocturno(!soloNocturno)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  soloNocturno
                    ? 'bg-indigo-900 text-white shadow-sm ring-2 ring-indigo-400'
                    : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" /> Noche (20hs+)
              </button>

              <FiltroDeliveryBotonPrincipal
                activo={soloDelivery}
                onCambiarActivo={(activo) => {
                  setSoloDelivery(activo);
                  if (!activo) setMomentoDelivery(null);
                }}
                elegido={momentoDelivery}
              />
            </div>

            <div>
              <FiltroDeliveryBotonConsulta
                activo={soloDelivery}
                onCambiarActivo={setSoloDelivery}
                elegido={momentoDelivery}
                onElegir={setMomentoDelivery}
                minutosAhora={momentoAhora.minutos}
              />
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">
                Medio de Pago:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { id: '', label: 'Todos', icon: null },
                  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                  { id: 'transferencia', label: 'Transferencia', icon: Building2 },
                ].map((mp) => {
                  const Icon = mp.icon;
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => setMedioPago(mp.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition shrink-0 inline-flex items-center gap-1.5 border ${
                        medioPago === mp.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/50'
                          : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                      {mp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">Más filtros:</span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { activo: soloConOfertas, alTocar: activarOfertas, Icono: Tag, texto: cargandoExtra === 'ofertas' ? 'Buscando ofertas…' : 'Con ofertas', clase: 'bg-amber-500 ring-amber-300', titulo: 'Comercios con ofertas o novedades vigentes hoy' },
                  { activo: soloMejorPuntaje, alTocar: activarPuntaje, Icono: Star, texto: cargandoExtra === 'puntaje' ? 'Calculando…' : `${PUNTAJE_MINIMO}★ o más`, clase: 'bg-yellow-500 ring-yellow-300', titulo: `Puntaje de ${PUNTAJE_MINIMO} estrellas o más, con al menos ${RESENAS_MINIMAS} reseñas` },
                  { activo: soloNuevos, alTocar: () => setSoloNuevos(!soloNuevos), Icono: Sparkles, texto: 'Nuevos', clase: 'bg-violet-600 ring-violet-300', titulo: `Se sumaron a NOGOYORK en los últimos ${DIAS_NUEVO} días` },
                ].map(({ activo, alTocar, Icono, texto, clase, titulo }) => (
                  <button
                    key={titulo}
                    type="button"
                    onClick={() => void alTocar()}
                    aria-pressed={activo}
                    title={titulo}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                      activo ? `${clase} text-white shadow-sm ring-2` : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icono className="w-3.5 h-3.5" aria-hidden="true" /> {texto}
                  </button>
                ))}
              </div>
              {errorExtra && <p role="alert" className="text-[11px] font-semibold text-red-600 dark:text-red-400">{errorExtra}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setSoloFarmaciasTurno(!soloFarmaciasTurno)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                  soloFarmaciasTurno
                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                    : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5" /> Farmacia de Turno
              </button>

              <button
                onClick={() => setSelectedRubro('')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition shrink-0 ${
                  selectedRubro === ''
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Todos los Rubros
              </button>

              {rubrosEnUso.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRubro(r.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition shrink-0 inline-flex items-center gap-1.5 ${
                    selectedRubro === r.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <InsigniaRubro rubro={r} className={selectedRubro === r.id ? 'ring-2 ring-white/70' : ''} />
                  {r.nombre}
                </button>
              ))}
            </div>

          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[600px]">
        <div className="lg:col-span-2 h-[350px] lg:h-full rounded-2xl overflow-hidden border dark:border-gray-700">
          <Suspense fallback={<div className="w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden="true" />}>
            <InteractiveMap
              comercios={filteredComercios}
              userLocation={userLocation}
              onSolicitarUbicacion={solicitarUbicacion}
              buscandoUbicacion={loadingLoc}
              pedidoCentrado={pedidoCentrado}
              radioKm={filtrarPorRadio ? radioKm : null}
            />
          </Suspense>
        </div>

        <div className="overflow-y-auto space-y-3 max-h-[500px] lg:max-h-full pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loadingComercios ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 w-2/3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-12"></div>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  <div className="pt-2 border-t dark:border-gray-700 flex justify-between">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredComercios.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Store className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-semibold">
                {soloAbiertos
                  ? 'No hay negocios abiertos en este momento'
                  : soloNocturno
                  ? 'No hay comercios con atención nocturna (20hs+) cargados'
                  : soloDelivery && momentoDelivery
                  ? `Ningún comercio tiene delivery ${textoMomentoElegido(momentoDelivery, hoyArgentina())}`
                  : soloDelivery
                  ? 'No hay comercios con delivery disponible (o lo pausaron por ahora)'
                  : soloFarmaciasTurno
                  ? 'No hay farmacias de turno registradas para hoy'
                  : soloConOfertas && conOfertas
                  ? 'Ningún comercio con esos filtros tiene ofertas vigentes hoy'
                  : soloMejorPuntaje && puntajes
                  ? `Ningún comercio con esos filtros tiene ${PUNTAJE_MINIMO}★ o más (con al menos ${RESENAS_MINIMAS} reseñas)`
                  : soloNuevos
                  ? `No se sumaron comercios con esos filtros en los últimos ${DIAS_NUEVO} días`
                  : 'No se encontraron negocios con esos filtros'}
              </p>
            </div>
          ) : (
            filteredComercios.map((comercio) => (
              <div key={comercio.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-500 transition space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {comercio.nombre}
                      <span title="Verificado" className="inline-flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      </span>
                    </h3>
                    <span className="text-[11px] font-bold text-brand-600 inline-flex items-center gap-1.5 flex-wrap">
                      <InsigniaRubro rubro={comercio.rubro} />
                      {comercio.rubro?.nombre || 'General'}
                      {comercio.puntajeNogoyork?.puntaje != null && (
                        <span className="text-amber-600 dark:text-amber-400" title={`${comercio.puntajeNogoyork.total} reseñas`}>
                          ★ {formatearPuntaje(comercio.puntajeNogoyork.puntaje)} ({comercio.puntajeNogoyork.total})
                        </span>
                      )}
                      {comercio.tieneOfertas && <span className="px-1.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">Oferta</span>}
                      {mostrarInsigniaNuevo && esNuevo(comercio.created_at, ahora) && <span className="px-1.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">Nuevo</span>}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      comercio.estadoAtencion.estado === 'abierto'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                        : comercio.estadoAtencion.estado === 'cierra_pronto'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    }`}>
                      {comercio.estadoAtencion.mensaje}
                    </span>
                    {textoEstadoDelivery(comercio.estadoDelivery) && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          comercio.estadoDelivery.estado === 'activo'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                            : comercio.estadoDelivery.estado === 'pausado'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        <Bike className="w-3 h-3" aria-hidden="true" /> {textoEstadoDelivery(comercio.estadoDelivery)}
                      </span>
                    )}
                    {comercio.distancia !== null && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md">
                        {formatearDistanciaTexto(comercio.distancia)}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{comercio.descripcion_corta}</p>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t dark:border-gray-700">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" /> {comercio.direccion}
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