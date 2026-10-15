import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, MessageCircle, Clock, ArrowLeft, Navigation, Phone } from 'lucide-react';
import { Comercio, HorarioAtencion } from '@/types/database.types';
import { evaluarEstadoHorario } from '@/lib/scheduleEvaluator';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { formatHora } from '@/lib/formatters';
import { obtenerComercioPorSlug } from '@/services/comercios';
import { DIAS_SEMANA, listarHorarios } from '@/services/horarios';
import { registrarInteraccion, registrarVisitaUnaVez } from '@/services/metricas';
import { CIUDAD, PROVINCIA } from '@/config/marca';

export const CommerceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no_encontrado' | 'error'>('cargando');

  useEffect(() => {
    if (!slug) return;
    let activo = true;

    const cargar = async () => {
      setEstado('cargando');
      try {
        const c = await obtenerComercioPorSlug(slug);
        if (!activo) return;
        if (!c) {
          setEstado('no_encontrado');
          return;
        }
        setComercio(c);
        setHorarios(await listarHorarios(c.id));
        setEstado('listo');
        registrarVisitaUnaVez(c.id);
      } catch (e) {
        console.error(e);
        if (activo) setEstado('error');
      }
    };
    void cargar();

    return () => {
      activo = false;
    };
  }, [slug]);

  if (estado === 'cargando') return <div className="p-8 text-center text-gray-500">Cargando comercio...</div>;

  if (estado !== 'listo' || !comercio) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-300 font-semibold">
          {estado === 'no_encontrado'
            ? 'Este comercio no existe o no está disponible en este momento.'
            : 'No pudimos cargar el comercio. Probá de nuevo en un rato.'}
        </p>
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al mapa
        </Link>
      </div>
    );
  }

  const estadoHorario = evaluarEstadoHorario(horarios);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${comercio.nombre}, ${comercio.direccion}, ${CIUDAD}, ${PROVINCIA}`,
  )}`;
  const whatsappUrl = buildWhatsAppUrl(comercio.whatsapp);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al mapa público
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{comercio.nombre}</h1>
            <p className="text-sm text-brand-600 font-semibold">{comercio.rubro?.nombre}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              estadoHorario.estado === 'abierto'
                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                : estadoHorario.estado === 'cierra_pronto'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            }`}
          >
            {estadoHorario.mensaje}
          </span>
        </div>

        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          {comercio.descripcion_completa || comercio.descripcion_corta}
        </p>

        {/* HORARIOS */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3 border dark:border-gray-700">
          <h2 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" aria-hidden="true" /> Horarios de Atención Semanal
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {DIAS_SEMANA.map((dia, idx) => {
              const turnosDia = horarios.filter((h) => h.dia_semana === idx && h.activo).sort((a, b) => a.turno - b.turno);
              return (
                <div key={dia} className="flex justify-between py-1 border-b dark:border-gray-800 last:border-none">
                  <dt className="font-semibold text-gray-600 dark:text-gray-400">{dia}</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">
                    {turnosDia.length > 0
                      ? turnosDia.map((t) => `${formatHora(t.hora_apertura)} - ${formatHora(t.hora_cierre)}`).join(' / ')
                      : 'Cerrado'}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        {/* UBICACIÓN Y CONTACTO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-500 shrink-0" aria-hidden="true" /> {comercio.direccion}
            </p>
            {comercio.telefono && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-brand-500 shrink-0" aria-hidden="true" />
                <a href={`tel:${comercio.telefono}`} className="hover:underline">
                  {comercio.telefono}
                </a>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => void registrarInteraccion(comercio.id, 'whatsapp')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
              </a>
            )}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => void registrarInteraccion(comercio.id, 'como_llegar')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 transition"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" /> Cómo llegar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
