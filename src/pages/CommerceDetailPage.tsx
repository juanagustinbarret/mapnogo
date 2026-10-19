import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, Link } from 'react-router-dom';
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
  Truck
} from 'lucide-react';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { registrarInteraccion } from '@/lib/metrics';
import { normalizeWhatsAppNumber, buildWhatsAppUrl } from '@/lib/whatsapp';
import { hoyArgentina, textoVencimiento } from '@/lib/fechasArgentina';
import { tieneCoordenadasPropias } from '@/lib/ubicacionComercios';

interface HorarioDelivery {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export const CommerceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([]);
  const [horariosDelivery, setHorariosDelivery] = useState<HorarioDelivery[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);

  const { user, profile, loading: cargandoSesion } = useAuth();
  
  // El dueño mirando su propia ficha y los admins no suman métricas
  const esPropioOAdmin = (c: Comercio | null) =>
    Boolean(c && ((user && c.propietario_id === user.id) || profile?.rol === 'admin'));
  const visitaRegistrada = useRef<string | null>(null);

  // La visita se registra una vez por ficha, cuando ya se sabe quién mira
  useEffect(() => {
    if (!comercio || cargandoSesion || visitaRegistrada.current === comercio.id) return;
    visitaRegistrada.current = comercio.id;
    void registrarInteraccion(comercio.id, 'visita', { excluir: esPropioOAdmin(comercio) });
  }, [comercio, cargandoSesion]);

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (slug) fetchComercio();
  }, [slug]);

  const fetchComercio = async () => {
    const { data: c } = await supabase.from('comercios').select('*, rubro:rubros(*)').eq('slug', slug).single();
    if (c) {
      setComercio(c);

      const { data: h } = await supabase
        .from('horarios_atencion')
        .select('*')
        .eq('comercio_id', c.id)
        .order('dia_semana', { ascending: true });
      if (h) setHorarios(h);

      // Cargar horarios específicos de delivery si el comercio los tiene configurados
      if (c.tiene_delivery) {
        const { data: hd } = await supabase
          .from('horarios_delivery')
          .select('*')
          .eq('comercio_id', c.id)
          .order('dia_semana', { ascending: true });
        if (hd) setHorariosDelivery(hd);
      }

      const hoyStr = hoyArgentina();
      const { data: p } = await supabase
        .from('promociones')
        .select('*')
        .eq('comercio_id', c.id)
        .eq('aprobada', true)
        .gte('fecha_fin', hoyStr);
      if (p) setPromociones(p);
    }
  };

  const handleWhatsAppClick = () => {
    if (!comercio) return;
    void registrarInteraccion(comercio.id, 'whatsapp', { excluir: esPropioOAdmin(comercio) });
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);
    const mensaje = `Hola *${comercio.nombre}*! 👋 Vi tu comercio en NOGOMAP y quisiera hacerles una consulta.`;
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
        text: `Mirá la ficha de ${comercio?.nombre} en NOGOMAP`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (!comercio) return <div className="p-8 text-center text-gray-500 font-semibold">Cargando ficha del comercio...</div>;

  const estadoHorario = evaluarEstadoHorario(horarios);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver al mapa público
        </Link>
        <button
          onClick={handleCompartir}
          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl transition text-gray-700 dark:text-gray-200"
          title="Compartir Ficha"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{comercio.nombre}</h1>
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

        {/* HORARIOS DE DELIVERY (SOLO MUESTRA SI EL COMERCIO TIENE DELIVERY ACTIVO) */}
        {comercio.tiene_delivery && (
          <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl space-y-3 border border-emerald-500/20">
            <div className="flex items-center justify-between border-b dark:border-emerald-800/40 pb-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" /> Horarios de Envíos a Domicilio (Delivery)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Delivery Activo
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
            <button
              onClick={handleWhatsAppClick}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <MessageCircle className="w-4 h-4" /> Consultar WhatsApp
            </button>

            <button
              onClick={handleComoLlegarClick}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 transition"
            >
              <Navigation className="w-4 h-4" /> Cómo llegar
            </button>
          </div>
        </div>
      </div>

      {promociones.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
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
    </div>
  );
};