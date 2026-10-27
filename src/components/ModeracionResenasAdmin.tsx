import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, MessageSquareX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NOTA_MAX, cargarSolicitudesPendientes, resolverSolicitud, type SolicitudEliminacion } from '@/lib/moderacionResenas';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' });
const boton = 'px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50';

// Pedidos de eliminación de reseñas que hicieron los comercios. Se cargan al
// abrir la pestaña (sin consultas periódicas).
export const ModeracionResenasAdmin: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudEliminacion[]>([]);
  const [comercios, setComercios] = useState<Record<string, { nombre: string; slug: string }>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = async () => {
    const r = await cargarSolicitudesPendientes();
    setDisponible(r.disponible);
    const ids = [...new Set(r.solicitudes.map((s) => s.comercio_id))];
    const cs = ids.length ? ((await supabase.from('comercios').select('id, nombre, slug').in('id', ids)).data ?? []) : [];
    setSolicitudes(r.solicitudes);
    setComercios(Object.fromEntries(cs.map((c: { id: string; nombre: string; slug: string }) => [c.id, c])));
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const resolver = async (s: SolicitudEliminacion, aprobar: boolean) => {
    setTrabajando(s.id);
    setError('');
    const r = await resolverSolicitud(s.id, aprobar, notas[s.id]);
    setTrabajando(null);
    if (!r.ok) return setError(r.mensaje);
    setSolicitudes((xs) => xs.filter((x) => x.id !== s.id));
  };

  return (
    <section aria-labelledby="titulo-resenas" className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 space-y-4">
      <h2 id="titulo-resenas" className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <MessageSquareX className="w-4 h-4 text-red-600" aria-hidden="true" /> Reseñas para eliminar ({cargando ? '…' : solicitudes.length})
      </h2>
      {!disponible && (
        <p className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-sm">
          Falta correr el SQL de supabase/propuestas/20261026_moderacion_resenas.sql y desplegar la función moderar-resenas.
        </p>
      )}
      {error && <p role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-semibold">{error}</p>}
      {disponible && !cargando && solicitudes.length === 0 && <p className="text-xs text-gray-500">No hay pedidos pendientes.</p>}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {solicitudes.map((s) => {
          const c = comercios[s.comercio_id];
          return (
            <li key={s.id} className="rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 space-y-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{c?.nombre ?? 'Comercio'}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 italic">“{s.resena_resumen ?? 'Reseña'}”</p>
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold">Motivo: {s.motivo}</p>
              <p className="text-[11px] text-gray-500">Pedido {fecha(s.created_at)}</p>
              <label htmlFor={`nota-${s.id}`} className="sr-only">Nota para el comercio (opcional)</label>
              <textarea
                id={`nota-${s.id}`}
                placeholder="Nota para el comercio (opcional)"
                value={notas[s.id] ?? ''}
                onChange={(e) => setNotas({ ...notas, [s.id]: e.target.value })}
                maxLength={NOTA_MAX}
                rows={2}
                className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={trabajando === s.id} onClick={() => void resolver(s, true)} className={`${boton} bg-red-600 text-white`}>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Aprobar y eliminar
                </button>
                <button type="button" disabled={trabajando === s.id} onClick={() => void resolver(s, false)} className={`${boton} bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100`}>
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Rechazar
                </button>
                {c && (
                  <Link to={`/comercio/${c.slug}`} target="_blank" className={`${boton} border dark:border-gray-700 text-gray-700 dark:text-gray-200`}>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Ficha
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
