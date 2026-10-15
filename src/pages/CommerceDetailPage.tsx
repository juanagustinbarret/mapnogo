import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Comercio, HorarioAtencion } from '@/types/database.types';
import { MapPin, MessageCircle, Clock, ArrowLeft, Navigation } from 'lucide-react';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { registrarInteraccion } from '@/lib/metrics';
import { normalizeWhatsAppNumber, buildWhatsAppUrl } from '@/lib/whatsapp';

export const CommerceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([]);

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (slug) fetchComercio();
  }, [slug]);

  const fetchComercio = async () => {
    const { data: c } = await supabase.from('comercios').select('*, rubro:rubros(*)').eq('slug', slug).single();
    if (c) {
      setComercio(c);

      // REGISTRAR EVENTO DE VISITA REAL EN LA BASE DE DATOS
      registrarInteraccion(c.id, 'visita');

      const { data: h } = await supabase
        .from('horarios_atencion')
        .select('*')
        .eq('comercio_id', c.id)
        .order('dia_semana', { ascending: true });
      if (h) setHorarios(h);
    }
  };

  const handleWhatsAppClick = () => {
    if (!comercio) return;

    // 1. Registrar métrica real
    registrarInteraccion(comercio.id, 'whatsapp');

    // 2. Abrir WhatsApp normalizado
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);
    const mensaje = `Hola *${comercio.nombre}*! 👋 Vi tu comercio en Nogoyá Cerca y quisiera hacerles una consulta.`;
    const url = buildWhatsAppUrl(numInfo.isValid ? numInfo.normalized : comercio.whatsapp, mensaje);
    window.open(url, '_blank');
  };

  const handleComoLlegarClick = () => {
    if (!comercio) return;

    // 1. Registrar métrica real
    registrarInteraccion(comercio.id, 'como_llegar');

    // 2. Abrir ruta en Google Maps (priorizando lat/lng si existen)
    const query = (comercio.latitud && comercio.longitud)
      ? `${comercio.latitud},${comercio.longitud}`
      : encodeURIComponent(`${comercio.nombre}, ${comercio.direccion}, Nogoyá, Entre Ríos`);
    
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  if (!comercio) return <div className="p-8 text-center text-gray-500 font-semibold">Cargando ficha del comercio...</div>;

  const estadoHorario = evaluarEstadoHorario(horarios);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Volver al mapa público
      </Link>

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

        {/* HORARIOS DE ATENCIÓN */}
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
                      ? turnosDia.map((t) => `${t.hora_apertura} - ${t.hora_cierre}`).join(' / ')
                      : 'Cerrado'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* UBICACIÓN Y ACCIONES CON REGISTRO DE EVENTO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4 text-brand-500 shrink-0" /> {comercio.direccion || 'Nogoyá, Entre Ríos'}
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
    </div>
  );
};