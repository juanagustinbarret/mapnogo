import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Rubro, HorarioAtencion } from '@/types/database.types';
import { InteractiveMap, type UbicacionUsuario } from '@/components/InteractiveMap';
import { Search, MapPin, Store, LocateFixed, Navigation, Clock, Sparkles, CheckCircle2, SlidersHorizontal, Filter, Bell, BellOff, Bike, HeartPulse, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import { OpcionesRubros } from '@/components/OpcionesRubros';
import { FiltroDelivery } from '@/components/FiltroDelivery';
import {
  DIAS_SEMANA,
  aHora,
  estadoDeliveryEn,
  momentoArgentina,
  textoEstadoDelivery,
  type MomentoArgentina,
  type RangoDelivery,
} from '@/lib/delivery';
import { calleEnCoordenadas } from '@/lib/geocodificacion';
import { posicionDeComercio, useGeocodificarComercios } from '@/lib/ubicacionComercios';
import {
  mensajeFalloPush,
  solicitarPermisoNotificacionesPush, 
  cancelarSuscripcionNotificacionesPush, 
  verificarEstadoSuscripcionPush 
} from '@/lib/pushNotifications';
import { hoyArgentina } from '@/lib/fechasArgentina';

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
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioAtencion[]>>({});
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  
  // Farmacia de Turno Hoy
  const [farmaciaDeTurno, setFarmaciaDeTurno] = useState<Comercio | null>(null);

  // FILTRO DINÁMICO DE ABIERTOS AHORA
  const [soloAbiertos, setSoloAbiertos] = useState(false);

  // Delivery: rangos por comercio, filtro y momento a evaluar
  const [delivery, setDelivery] = useState<Record<string, RangoDelivery[]>>({});
  const [soloDelivery, setSoloDelivery] = useState(false);
  const [momentoElegido, setMomentoElegido] = useState<MomentoArgentina | null>(null);

  // Re-evaluación automática de horarios cada 60 segundos
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

  // Filtros de Cercanía Inteligente
  const [radioKm, setRadioKm] = useState<number | null>(null);
  const [ordenamiento, setOrdenamiento] = useState<'cercania' | 'nombre'>('cercania');
  
  const [userAddress, setUserAddress] = useState<string>('Nogoyá, Entre Ríos');
  const [userLocation, setUserLocation] = useState<UbicacionUsuario | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [pedidoCentrado, setPedidoCentrado] = useState(0);
  const seguimientoId = useRef<number | null>(null);

  // Notificaciones Push
  const [activandoPush, setActivandoPush] = useState(false);
  const [pushActivado, setPushActivado] = useState(false);

  useEffect(() => {
    fetchData();
    verificarEstadoSuscripcionPush().then((activo) => setPushActivado(activo));
  }, []);

  const detenerSeguimiento = useCallback(() => {
    if (seguimientoId.current !== null) {
      navigator.geolocation.clearWatch(seguimientoId.current);
      seguimientoId.current = null;
    }
  }, []);

  useEffect(() => detenerSeguimiento, [detenerSeguimiento]);

  const fetchData = async () => {
    const { data: rubrosData } = await supabase.from('rubros').select('*').eq('estado', true).order('orden');
    const { data: comerciosData } = await supabase
      .from('comercios')
      .select('*, rubro:rubros(*)')
      .eq('aprobado', true)
      .eq('habilitado_admin', true);

    const { data: horariosData } = await supabase.from('horarios_atencion').select('*');

    // Cargar Farmacia de Turno para la fecha de hoy en Argentina
    const fechaHoy = hoyArgentina();
    const { data: turnoData } = await supabase
      .from('farmacias_turno')
      .select('comercio_id, comercio:comercios(*, rubro:rubros(*))')
      .eq('fecha', fechaHoy)
      .maybeSingle();

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
  };

  const handleToggleNotificaciones = async () => {
    setActivandoPush(true);

    if (pushActivado) {
      const exito = await cancelarSuscripcionNotificacionesPush();
      setActivandoPush(false);
      if (exito) {
        setPushActivado(false);
        setTimeout(() => alert('Te diste de baja de las notificaciones de ofertas.'), 50);
      } else {
        setTimeout(() => alert('No se pudo cancelar la suscripción.'), 50);
      }
    } else {
      const resultado = await solicitarPermisoNotificacionesPush();
      setActivandoPush(false);

      if (resultado.ok) {
        setPushActivado(true);
        setTimeout(() => alert('¡Notificaciones activadas con éxito! Vas a recibir alertas de promociones.'), 50);
      } else {
        const mensaje = mensajeFalloPush(resultado);
        setTimeout(() => alert(mensaje), 50);
      }
    }
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
  const momentoDelivery = momentoElegido ?? momentoAhora;

  // LÓGICA COMPLETA DE FILTRADO DINÁMICO
  const filteredComercios = comercios
    .map((c) => {
      const posicion = posicionDeComercio(c);
      const distancia =
        userLocation && posicion ? calcularDistanciaKm(userLocation.lat, userLocation.lng, posicion.lat, posicion.lng) : null;
      const estadoAtencion = evaluarEstadoHorario(horarios[c.id] || [], ahora);
      const estadoDelivery = estadoDeliveryEn(c.tiene_delivery ? delivery[c.id] ?? [] : [], momentoDelivery);
      return { ...c, distancia, estadoAtencion, estadoDelivery };
    })
    .filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const coincideNombre = c.nombre.toLowerCase().includes(q);
        const coincideDesc = c.descripcion_corta?.toLowerCase().includes(q);
        const coincideDir = c.direccion?.toLowerCase().includes(q);
        const coincideRubro = c.rubro?.nombre?.toLowerCase().includes(q);
        if (!coincideNombre && !coincideDesc && !coincideDir && !coincideRubro) {
          return false;
        }
      }

      if (selectedRubro && c.rubro_id !== selectedRubro) {
        return false;
      }

      if (soloAbiertos) {
        const est = c.estadoAtencion.estado;
        if (est !== 'abierto' && est !== 'cierra_pronto') {
          return false;
        }
      }

      if (soloDelivery) {
        if (c.estadoDelivery.estado !== 'activo') {
          return false;
        }
      }

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

  const etiquetaMomento = momentoElegido
    ? `${DIAS_SEMANA[momentoElegido.dia].slice(0, 3)} ${aHora(momentoElegido.minutos)}`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* BANNER DESTACADO: FARMACIA DE TURNO HOY */}
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
            {farmaciaDeTurno.whatsapp && (
              <a
                href={`https://wa.me/${farmaciaDeTurno.whatsapp}`}
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

      {/* TARJETA DE BIENVENIDA Y UBICACIÓN */}
      <div className="bg-gradient-to-r from-brand-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Directorio Comercial Inteligente
          </div>
          <h1 className="text-2xl font-black">Explorá Comercios en Nogoyá</h1>
          <p className="text-xs text-brand-100 flex items-center gap-1">
            <LocateFixed className="w-3.5 h-3.5" /> Ubicación: <strong className="text-white">{userAddress}</strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleToggleNotificaciones}
            disabled={activandoPush}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition shrink-0 disabled:opacity-60 ${
              pushActivado
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-gray-900'
            }`}
            title={pushActivado ? 'Hacé clic para desactivar ofertas' : 'Recibir avisos de ofertas y promociones'}
          >
            {pushActivado ? (
              <>
                <BellOff className="w-4 h-4 text-white" />
                {activandoPush ? 'Procesando...' : 'Ofertas Activas (Desactivar)'}
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-gray-900" />
                {activandoPush ? 'Activando...' : 'Recibir Ofertas'}
              </>
            )}
          </button>

          <button
            onClick={solicitarUbicacion}
            disabled={loadingLoc}
            className="px-4 py-2.5 bg-white text-brand-700 hover:bg-brand-50 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition shrink-0"
          >
            <Navigation className="w-4 h-4" />{' '}
            {loadingLoc ? 'Obteniendo...' : userLocation ? 'Centrar en Mi Ubicación' : 'Usar Mi Ubicación'}
          </button>
        </div>
      </div>

      {/* PANEL PRINCIPAL DE CONTROLES Y FILTROS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 pt-4 pb-3 space-y-3">
        <div className="px-4 relative w-full">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por negocio, rubro o calle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
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

        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 w-full">
          <div className="px-4 sm:hidden flex flex-col gap-2">
            <button
              onClick={() => setSoloAbiertos(!soloAbiertos)}
              className={`w-full py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                soloAbiertos
                  ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-400'
                  : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> {soloAbiertos ? '✓ Mostrando solo Abiertos' : 'Abiertos Ahora'}
            </button>

            <FiltroDelivery
              anchoCompleto
              activo={soloDelivery}
              onCambiarActivo={setSoloDelivery}
              momento={momentoElegido}
              momentoAhora={momentoAhora}
              onCambiarMomento={setMomentoElegido}
            />

            <div className="relative w-full">
              <select
                value={selectedRubro}
                onChange={(e) => setSelectedRubro(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-bold text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none appearance-none pr-8"
              >
                <option value="">Todos los Rubros</option>
                <OpcionesRubros rubros={rubrosEnUso} />
              </select>
              <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-2 px-4 py-1 w-full">
            <button
              onClick={() => setSoloAbiertos(!soloAbiertos)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                soloAbiertos
                  ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-400'
                  : 'bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> {soloAbiertos ? '✓ Mostrando solo Abiertos' : 'Abiertos Ahora'}
            </button>

            <FiltroDelivery
              activo={soloDelivery}
              onCambiarActivo={setSoloDelivery}
              momento={momentoElegido}
              momentoAhora={momentoAhora}
              onCambiarMomento={setMomentoElegido}
            />

            <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />

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

      {/* MAPA INTERACTIVO Y LISTA FILTRADA DE COMERCIOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[600px]">
        <div className="lg:col-span-2 h-[350px] lg:h-full rounded-2xl overflow-hidden border dark:border-gray-700">
          <InteractiveMap
            comercios={filteredComercios}
            userLocation={userLocation}
            onSolicitarUbicacion={solicitarUbicacion}
            buscandoUbicacion={loadingLoc}
            pedidoCentrado={pedidoCentrado}
            radioKm={filtrarPorRadio ? radioKm : null}
          />
        </div>

        <div className="overflow-y-auto space-y-3 max-h-[500px] lg:max-h-full pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filteredComercios.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Store className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-semibold">
                {soloAbiertos
                  ? 'No hay negocios abiertos en este momento'
                  : soloDelivery
                  ? `Ningún comercio tiene delivery ${etiquetaMomento ? `el ${etiquetaMomento}` : 'activo en este momento'}`
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
                    <span className="text-[11px] font-bold text-brand-600 inline-flex items-center gap-1.5">
                      <InsigniaRubro rubro={comercio.rubro} />
                      {comercio.rubro?.nombre || 'General'}
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