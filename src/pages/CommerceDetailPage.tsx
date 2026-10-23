import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Comercio, HorarioAtencion, Promocion } from '@/types/database.types';
import { 
  MapPin, 
  MessageCircle, 
  Clock, 
  ArrowLeft, 
  Navigation, 
  Tag, 
  CheckCircle2, 
  CreditCard, 
  Share2, 
  Copy,
  CalendarDays,
  Truck,
  Star,
  AlertTriangle,
  MessageSquare,
  X,
  Send,
  Heart
} from 'lucide-react';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { aplicarPausa, estadoDelivery, rangosDeDelivery, textoEstadoDelivery } from '@/lib/delivery';
import { registrarInteraccion } from '@/lib/metrics';
import { COLUMNAS_PUBLICAS_COMERCIO } from '@/lib/columnasPublicas';
import { normalizeWhatsAppNumber, buildWhatsAppUrl } from '@/lib/whatsapp';
import { hoyArgentina, textoVencimiento } from '@/lib/fechasArgentina';
import { tieneCoordenadasPropias } from '@/lib/ubicacionComercios';
import { elegirPorSlugLimpio, patronSlugLimpio, slugLimpio } from '@/lib/rutasQr';
import {
  COLUMNAS_RESENA,
  LARGO_COMENTARIO,
  LARGO_NOMBRE,
  MENSAJE_YA_RESENO,
  estrellasValidas,
  marcarResenado,
  mensajeErrorResena,
  yaReseno,
} from '@/lib/resenas';
import { calcularPuntaje } from '@/lib/puntajePropio';
import { etiquetaPuntaje, fechaResena, textoPuntaje } from '@/lib/puntaje';
import { Estrellas } from '@/components/Estrellas';
import { CarruselFotosComercio } from '@/components/CarruselFotosComercio';
import { ReportarFoto } from '@/components/ReportarFoto';
import { cargarFotosComercio, fotosParaMostrar, type FotoComercio } from '@/lib/fotosComercio';

interface HorarioDelivery {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

interface Resena {
  id: string;
  nombre_usuario: string;
  estrellas: number;
  comentario: string;
  created_at: string;
}

export const CommerceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { hash } = useLocation();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [loadingComercio, setLoadingComercio] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [fotosAprobadas, setFotosAprobadas] = useState<FotoComercio[]>([]);
  const [fotoAReportar, setFotoAReportar] = useState<{ url: string; fotoId?: string; indiceGaleria?: number } | null>(null);
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([]);
  const [horariosDelivery, setHorariosDelivery] = useState<HorarioDelivery[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  
  const [esFavorito, setEsFavorito] = useState(false);

  const [resenas, setResenas] = useState<Resena[]>([]);
  const [modalReporteOpen, setModalReporteOpen] = useState(false);
  const [motivoReporte, setMotivoReporte] = useState('Horarios incorrectos');
  const [descReporte, setDescReporte] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  const [nombreResena, setNombreResena] = useState('');
  const [estrellasResena, setEstrellasResena] = useState(5);
  const [comentarioResena, setComentarioResena] = useState('');
  const [guardandoResena, setGuardandoResena] = useState(false);

  const { user, profile, loading: cargandoSesion } = useAuth();
  
  const esPropioOAdmin = (c: Comercio | null) =>
    Boolean(c && ((user && c.propietario_id === user.id) || profile?.rol === 'admin'));
  const visitaRegistrada = useRef<string | null>(null);

  useEffect(() => {
    if (!comercio || cargandoSesion || visitaRegistrada.current === comercio.id) return;
    visitaRegistrada.current = comercio.id;
    void registrarInteraccion(comercio.id, 'visita', { excluir: esPropioOAdmin(comercio) });
    
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('nogoyork_favoritos') || '[]');
      setEsFavorito(favs.includes(comercio.id));
    } catch {
      // Ignorar errores de parsing
    }
  }, [comercio, cargandoSesion]);

  const toggleFavorito = () => {
    if (!comercio) return;
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('nogoyork_favoritos') || '[]');
      let nuevosFavs: string[];
      if (esFavorito) {
        nuevosFavs = favs.filter(id => id !== comercio.id);
        setEsFavorito(false);
      } else {
        nuevosFavs = [...favs, comercio.id];
        setEsFavorito(true);
      }
      localStorage.setItem('nogoyork_favoritos', JSON.stringify(nuevosFavs));
    } catch {
      // Ignorar
    }
  };

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (slug) fetchComercio();
  }, [slug]);

  useEffect(() => {
    const destino = hash === '#resenas' || hash === '#promociones' ? hash.slice(1) : null;
    if (!comercio || !destino) return;
    const t = setTimeout(() => document.getElementById(destino)?.scrollIntoView({ block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [comercio, hash, promociones.length]);

  const fetchComercio = async () => {
    setLoadingComercio(true);
    const buscar = async (filtrar: (consulta: any) => any, limite: number) => {
      const pedir = (columnas: string) =>
        filtrar(supabase.from('comercios').select(`${columnas}, rubro:rubros(*)` as '*')).limit(limite);
      let { data, error } = await pedir(COLUMNAS_PUBLICAS_COMERCIO);
      if (error) ({ data } = await pedir('*'));
      return (data ?? []) as any[];
    };
    
    let c: any = (await buscar((q) => q.eq('slug', slug), 1))[0] ?? null;

    if (!c && slug) {
      const limpio = slugLimpio(slug);
      if (limpio) c = elegirPorSlugLimpio(await buscar((q) => q.ilike('slug', patronSlugLimpio(limpio)), 25), limpio);
    }
    if (!c) {
      setNoEncontrado(true);
      setLoadingComercio(false);
      return;
    }

    setNoEncontrado(false);
    // PASO 1: Renderizar la información básica del comercio inmediatamente
    setComercio(c);
    setLoadingComercio(false);

    // PASO 2: Traer los datos secundarios de forma asíncrona sin bloquear la pantalla
    const hoyStr = hoyArgentina();
    Promise.all([
      supabase.from('horarios_atencion').select('*').eq('comercio_id', c.id).order('dia_semana', { ascending: true }),
      c.tiene_delivery
        ? supabase.from('horarios_delivery').select('*').eq('comercio_id', c.id).order('dia_semana', { ascending: true })
        : Promise.resolve({ data: null }),
      supabase.from('promociones').select('*').eq('comercio_id', c.id).eq('aprobada', true).gte('fecha_fin', hoyStr),
      supabase.from('resenas').select(COLUMNAS_RESENA).eq('comercio_id', c.id).order('created_at', { ascending: false }),
      cargarFotosComercio(c.id),
    ]).then(([{ data: h }, { data: hd }, { data: p }, { data: r }, fotosRes]) => {
      if (h) setHorarios(h);
      if (hd) setHorariosDelivery(hd);
      if (p) setPromociones(p);
      if (r) setResenas(r);
      if (fotosRes) setFotosAprobadas(fotosRes.fotos);
    }).catch((err) => console.error('Error cargando detalles secundarios:', err));
  };

  const fetchResenas = async (comercioId: string) => {
    const { data: r } = await supabase
      .from('resenas')
      .select(COLUMNAS_RESENA)
      .eq('comercio_id', comercioId)
      .order('created_at', { ascending: false });
    if (r) setResenas(r);
  };

  const handleCrearResena = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio || !nombreResena.trim() || !comentarioResena.trim()) return;
    if (yaReseno(comercio.id)) {
      alert(MENSAJE_YA_RESENO);
      return;
    }

    setGuardandoResena(true);
    const { error } = await supabase.from('resenas').insert({
      comercio_id: comercio.id,
      nombre_usuario: nombreResena.trim(),
      estrellas: estrellasResena,
      comentario: comentarioResena.trim(),
    });

    setGuardandoResena(false);

    if (error) {
      if (error.code === '23505') marcarResenado(comercio.id);
      alert(mensajeErrorResena(error));
    } else {
      marcarResenado(comercio.id);
      setNombreResena('');
      setComentarioResena('');
      setEstrellasResena(5);
      alert('¡Gracias por tu opinión!');
      fetchResenas(comercio.id);
    }
  };

  const handleEnviarReporte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;

    setEnviandoReporte(true);
    const { error } = await supabase.from('reportes_comercio').insert({
      comercio_id: comercio.id,
      motivo: motivoReporte,
      descripcion: descReporte.trim() || null,
    });

    setEnviandoReporte(false);

    if (error) {
      alert('Error al enviar el reporte: ' + error.message);
    } else {
      setModalReporteOpen(false);
      setDescReporte('');
      alert('¡Gracias! El administrador revisará el reporte a la brevedad.');
    }
  };

  const handleWhatsAppClick = () => {
    if (!comercio) return;
    void registrarInteraccion(comercio.id, 'whatsapp', { excluir: esPropioOAdmin(comercio) });
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);
    const mensaje = `Hola *${comercio.nombre}*! 👋 Vi su comercio en NOGOYORK y quisiera hacerles una consulta.`;
    const url = buildWhatsAppUrl(numInfo.isValid ? numInfo.normalized : comercio.whatsapp, mensaje);
    window.open(url, '_blank');
  };

  const handleComoLlegarClick = () => {
    if (!comercio) return;
    void registrarInteraccion(comercio.id, 'como_llegar', { excluir: esPropioOAdmin(comercio) });
    const query = tieneCoordenadasPropias(comercio)
      ? `${comercio.latitud},${comercio.longitud}`
      : encodeURIComponent(`${comercio.nombre}, ${comercio.direccion}, Nogoyá, Entre Ríos`);
    
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleCopiarDireccion = () => {
    if (comercio?.direccion) {
      navigator.clipboard.writeText(`${comercio.direccion}, Nogoyá, Entre Ríos`);
      alert('¡Dirección copiada!');
    }
  };

  const handleCompartir = () => {
    if (navigator.share) {
      navigator.share({
        title: comercio?.nombre,
        text: `Mirá la ficha de ${comercio?.nombre} en NOGOYORK`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (!comercio && noEncontrado) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-gray-700 dark:text-gray-200 font-semibold">No encontramos este comercio.</p>
        <Link to="/" className="inline-block text-brand-600 font-bold">Ver el mapa de comercios</Link>
      </div>
    );
  }

  // SKELETON LOADER
  if (loadingComercio || !comercio) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-36"></div>
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-24"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-8"></div>
          </div>
        </div>

        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-3xl w-full"></div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-1/2">
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3"></div>
            </div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
          </div>

          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>

          <div className="h-32 bg-gray-100 dark:bg-gray-900 rounded-2xl w-full"></div>
        </div>
      </div>
    );
  }

  const fotosFicha = fotosParaMostrar(fotosAprobadas, comercio.galeria_urls);
  const tieneWhatsApp = /\d/.test(comercio.whatsapp ?? '');
  const estadoHorario = evaluarEstadoHorario(horarios);
  const estadoDeliveryAhora = aplicarPausa(
    estadoDelivery(rangosDeDelivery(horariosDelivery, horarios)),
    comercio?.delivery_pausado_hasta,
  );
  const textoDeliveryAhora = textoEstadoDelivery(estadoDeliveryAhora) ?? 'Sin delivery en este momento';
  const puntajePropio = calcularPuntaje(resenas.map((r) => r.estrellas));
  const promedioEstrellas = textoPuntaje(puntajePropio.puntaje, puntajePropio.total);
  const yaOpino = yaReseno(comercio.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver al mapa público
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorito}
            className={`p-2 rounded-xl transition text-xs font-bold inline-flex items-center gap-1.5 ${
              esFavorito 
                ? 'bg-rose-500 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200'
            }`}
            title={esFavorito ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Heart className={`w-4 h-4 ${esFavorito ? 'fill-white' : ''}`} />
            <span className="hidden sm:inline">{esFavorito ? 'Guardado' : 'Favorito'}</span>
          </button>

          <button
            onClick={() => setModalReporteOpen(true)}
            className="p-2 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 rounded-xl transition text-xs font-bold inline-flex items-center gap-1"
            title="Reportar información incorrecta"
          >
            <AlertTriangle className="w-4 h-4" /> Reportar
          </button>
          <button
            onClick={handleCompartir}
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl transition text-gray-700 dark:text-gray-200"
            title="Compartir Ficha"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {fotosFicha.length > 0 && (
        <CarruselFotosComercio
          fotos={fotosFicha.map((f) => f.url)}
          nombreComercio={comercio.nombre}
          alReportar={(i) => setFotoAReportar(fotosFicha[i] ?? null)}
        />
      )}
      {fotoAReportar && <ReportarFoto comercioId={comercio.id} foto={fotoAReportar} onCerrar={() => setFotoAReportar(null)} />}

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              {comercio.nombre}
              {promedioEstrellas && (
                <a
                  href="#resenas"
                  aria-label={`${etiquetaPuntaje(puntajePropio.puntaje, puntajePropio.total)}. Ver reseñas`}
                  className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 hover:underline"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /> {promedioEstrellas}
                </a>
              )}
            </h1>
            <p className="text-sm text-brand-600 font-bold">{comercio.rubro?.nombre || 'General'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            estadoHorario.estado === 'abierto'
              ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
          }`}>
            {estadoHorario.mensaje}
          </span>
        </div>

        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          {comercio.descripcion_corta || 'Sin descripción disponible.'}
        </p>

        {(comercio.servicios?.length || comercio.medios_pago?.length) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            {comercio.servicios && comercio.servicios.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" /> Servicios
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {comercio.servicios.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-medium rounded-lg">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {comercio.medios_pago && comercio.medios_pago.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-brand-600" /> Medios de Pago
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {comercio.medios_pago.map((m, i) => (
                    <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-medium rounded-lg">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* HORARIOS DE ATENCIÓN COMERCIAL */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3 border dark:border-gray-700/60">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" /> Horarios de Atención Semanal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {diasSemana.map((dia, idx) => {
              const turnosDia = horarios.filter((h) => h.dia_semana === idx);
              return (
                <div key={dia} className="flex justify-between py-1 border-b dark:border-gray-800 last:border-none">
                  <span className="font-semibold text-gray-600 dark:text-gray-400">{dia}:</span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {turnosDia.length > 0
                      ? turnosDia.map((t) => `${t.hora_apertura.slice(0, 5)} - ${t.hora_cierre.slice(0, 5)}`).join(' / ')
                      : 'Cerrado'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* HORARIOS DE DELIVERY */}
        {comercio.tiene_delivery && (
          <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl space-y-3 border border-emerald-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-emerald-800/40 pb-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" /> Horarios de Envíos a Domicilio (Delivery)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  estadoDeliveryAhora.estado === 'activo'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : estadoDeliveryAhora.estado === 'pausado'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                }`}
              >
                {textoDeliveryAhora}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {diasSemana.map((dia, idx) => {
                const turnosDeliveryDia = horariosDelivery.filter((h) => Number(h.dia_semana) === idx);
                return (
                  <div key={dia} className="flex justify-between py-1 border-b dark:border-gray-800/50 last:border-none">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">{dia}:</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {horariosDelivery.length === 0 ? (
                        <span className="text-gray-500 font-sans">Mismo horario que atención al público</span>
                      ) : turnosDeliveryDia.length > 0 ? (
                        turnosDeliveryDia.map((t) => `${t.hora_inicio.slice(0, 5)} - ${t.hora_fin.slice(0, 5)}`).join(' / ')
                      ) : (
                        <span className="text-gray-400 font-sans">Sin envíos</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-500 shrink-0" /> {comercio.direccion || 'Nogoyá, Entre Ríos'}
            </div>
            <button
              onClick={handleCopiarDireccion}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-bold ml-2"
              title="Copiar dirección"
            >
              <Copy className="w-3 h-3" /> Copiar
            </button>
          </div>

          <div className="flex items-center gap-2">
            {tieneWhatsApp && (
              <button
                onClick={handleWhatsAppClick}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> Consultar WhatsApp
              </button>
            )}

            <button
              onClick={handleComoLlegarClick}
              className={`${tieneWhatsApp ? '' : 'flex-1 justify-center '}inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 transition`}
            >
              <Navigation className="w-4 h-4" /> Cómo llegar
            </button>
          </div>
        </div>
      </div>

      {promociones.length > 0 && (
        <div id="promociones" className="scroll-mt-20 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" /> Ofertas y Novedades Vigentes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {promociones.map((p) => {
              const vencInfo = textoVencimiento(p.fecha_fin);
              return (
                <div key={p.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between items-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                        p.tipo === 'novedad'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {p.tipo === 'novedad' ? 'Novedad' : 'Oferta'}
                    </span>
                    {vencInfo.texto && (
                      <span className={`text-[11px] font-medium flex items-center gap-1 ${
                        vencInfo.estaPorVencer ? 'text-amber-600 font-bold' : 'text-gray-500'
                      }`}>
                        <CalendarDays className="w-3 h-3" /> {vencInfo.texto}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{p.titulo}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{p.descripcion}</p>
                  {p.precio_promocional && (
                    <div className="text-base font-extrabold text-green-600 dark:text-green-400">
                      ${p.precio_promocional.toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section id="resenas" aria-labelledby="titulo-resenas" className="scroll-mt-20 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-resenas" className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-600" aria-hidden="true" /> Reseñas
          </h2>
          {promedioEstrellas && (
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white" aria-label={etiquetaPuntaje(puntajePropio.puntaje, puntajePropio.total)}>
              <Estrellas puntaje={puntajePropio.puntaje} total={puntajePropio.total} />
              <span aria-hidden="true">{promedioEstrellas}</span>
            </p>
          )}
        </div>

        {yaOpino ? (
          <p className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300" role="status">
            {MENSAJE_YA_RESENO}
          </p>
        ) : (
          <form onSubmit={handleCrearResena} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3 border dark:border-gray-700">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Dejá tu opinión sobre {comercio.nombre}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                maxLength={LARGO_NOMBRE}
                placeholder="Tu nombre (ej. Carlos G.)"
                value={nombreResena}
                onChange={(e) => setNombreResena(e.target.value)}
                className="p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
              />

              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl">
                <span className="text-xs text-gray-500 mr-2 font-semibold">Calificación:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEstrellasResena(star)}
                    className="p-0.5 focus:outline-none"
                  >
                    <Star className={`w-4 h-4 ${star <= estrellasResena ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              required
              rows={2}
              maxLength={LARGO_COMENTARIO}
              placeholder="Escribí tu reseña sobre la atención, los productos..."
              value={comentarioResena}
              onChange={(e) => setComentarioResena(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
            />

            <button
              type="submit"
              disabled={guardandoResena}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {guardandoResena ? 'Publicando...' : 'Publicar Reseña'}
            </button>
            <p className="text-[11px] text-gray-500">
              Tu reseña se publica con el nombre que pongas. Al publicar aceptás los{' '}
              <Link to="/terminos" className="text-brand-600 hover:underline">Términos</Link> y la{' '}
              <Link to="/privacidad" className="text-brand-600 hover:underline">Política de privacidad</Link>.
            </p>
          </form>
        )}

        <div className="space-y-3">
          {resenas.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Aún no hay reseñas para este comercio. ¡Sé el primero en calificar!</p>
          ) : (
            resenas.map((r) => (
              <div key={r.id} className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-1.5 border dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-gray-900 dark:text-white break-words min-w-0">{r.nombre_usuario}</span>
                  <span className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
                    <Estrellas puntaje={estrellasValidas(r.estrellas)} etiqueta={`${estrellasValidas(r.estrellas)} de 5 estrellas`} tamano="w-3 h-3" />
                    {fechaResena(r.created_at) && <time dateTime={r.created_at}>{fechaResena(r.created_at)}</time>}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line break-words">{r.comentario}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {modalReporteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Reportar Información Incorrecta
              </h3>
              <button onClick={() => setModalReporteOpen(false)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnviarReporte} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Motivo del reporte</label>
                <select
                  value={motivoReporte}
                  onChange={(e) => setMotivoReporte(e.target.value)}
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="Horarios incorrectos">Horarios incorrectos o desactualizados</option>
                  <option value="Teléfono/WhatsApp equivocado">Teléfono o WhatsApp equivocado</option>
                  <option value="Ubicación en el mapa errónea">Ubicación errónea en el mapa</option>
                  <option value="Comercio cerrado definitivamente">El local cerró definitivamente</option>
                  <option value="Otro motivo">Otro motivo</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Detalles del problema</label>
                <textarea
                  rows={3}
                  placeholder="Escribí aquí la corrección para ayudar al equipo..."
                  value={descReporte}
                  onChange={(e) => setDescReporte(e.target.value)}
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalReporteOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoReporte}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {enviandoReporte ? 'Enviando...' : 'Enviar Reporte'}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                No incluyas datos personales de otras personas. Ver{' '}
                <Link to="/privacidad" className="text-brand-600 hover:underline">Política de privacidad</Link>.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};