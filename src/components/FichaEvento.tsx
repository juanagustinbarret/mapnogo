import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CalendarPlus, Clock, MapPin, Navigation, Share2, X } from 'lucide-react';
import {
  archivoCalendario,
  linkComoLlegarEvento,
  linkEvento,
  puntoDelEvento,
  textoFechaEvento,
  textoHorarioEvento,
  type EventoPublico,
} from '@/lib/eventos';

const MapaEvento = lazy(() => import('@/components/MapaEvento').then((m) => ({ default: m.MapaEvento })));

interface Props {
  evento: EventoPublico | null;
  onClose: () => void;
}

/** Ficha de un evento: toda la info, cómo llegar, agendar y compartir. */
export const FichaEvento: React.FC<Props> = ({ evento, onClose }) => {
  const [aviso, setAviso] = useState('');
  const [imagenRota, setImagenRota] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;
  const abierta = evento !== null;

  // Escape cierra, el fondo no se desplaza y el foco vuelve a donde estaba
  useEffect(() => {
    if (!abierta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar.current();
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [abierta]);

  useEffect(() => {
    setAviso('');
    setImagenRota(false);
  }, [evento?.id]);

  if (!evento) return null;

  // Con punto marcado en el mapa, "Cómo llegar" va a ese punto exacto
  const punto = puntoDelEvento(evento);
  const comoLlegar = linkComoLlegarEvento(evento.ubicacion_texto, punto);
  const horario = evento.hora_inicio ? textoHorarioEvento(evento.hora_inicio, evento.hora_fin) : null;
  const link = linkEvento(window.location.origin, evento.id);

  const agendar = () => {
    const blob = new Blob([archivoCalendario(evento)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${evento.titulo.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'evento'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const compartir = async () => {
    const texto = [evento.titulo, `${textoFechaEvento(evento.fecha_evento)}${horario ? ` · ${horario}` : ''}`, evento.ubicacion_texto]
      .filter(Boolean)
      .join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: evento.titulo, text: texto, url: link });
      } catch {
        /* el usuario canceló */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${texto}\n${link}`);
      setAviso('Link copiado');
    } catch {
      setAviso('No se pudo copiar el link');
    }
  };

  const fila = 'flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200';
  const icono = 'w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5';
  const boton =
    'flex-1 min-w-[8.5rem] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-black transition active:scale-95';

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-ficha-evento"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl border border-amber-200 dark:border-gray-700">
        {evento.imagen_url && !imagenRota && (
          <img
            src={evento.imagen_url}
            alt=""
            onError={() => setImagenRota(true)}
            className="w-full max-h-56 object-cover rounded-t-3xl"
          />
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Evento</p>
              <h2 id="titulo-ficha-evento" className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                {evento.titulo}
              </h2>
            </div>
            <button
              ref={cerrarRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2.5 bg-amber-50 dark:bg-gray-900 border border-amber-100 dark:border-gray-700 rounded-2xl p-4">
            <p className={fila}>
              <CalendarDays className={icono} aria-hidden="true" />
              <span><b>Fecha:</b> {textoFechaEvento(evento.fecha_evento)}</span>
            </p>
            {horario && (
              <p className={fila}>
                <Clock className={icono} aria-hidden="true" />
                <span><b>Horario:</b> {horario}</span>
              </p>
            )}
            {evento.ubicacion_texto && (
              <p className={fila}>
                <MapPin className={icono} aria-hidden="true" />
                <span><b>Lugar:</b> {evento.ubicacion_texto}</span>
              </p>
            )}
          </div>

          {punto && (
            <Suspense fallback={<div className="h-[162px] rounded-2xl bg-gray-100 dark:bg-gray-800" aria-hidden="true" />}>
              <MapaEvento punto={punto} titulo={evento.titulo} />
            </Suspense>
          )}

          {evento.descripcion && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{evento.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {comoLlegar && (
              <a
                href={comoLlegar}
                target="_blank"
                rel="noopener noreferrer"
                className={`${boton} w-full bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-md`}
              >
                <Navigation className="w-4 h-4" aria-hidden="true" /> Cómo llegar
              </a>
            )}
            <button
              type="button"
              onClick={agendar}
              className={`${boton} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white`}
            >
              <CalendarPlus className="w-4 h-4" aria-hidden="true" /> Agendar
            </button>
            <button
              type="button"
              onClick={compartir}
              className={`${boton} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white`}
            >
              <Share2 className="w-4 h-4" aria-hidden="true" /> Compartir
            </button>
          </div>

          <p role="status" aria-live="polite" className="text-xs text-center text-gray-500 min-h-[1rem]">
            {aviso}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
