import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  MOTIVO_MAX,
  MOTIVO_MIN,
  cargarSolicitudesDeComercio,
  solicitarEliminacion,
  validarMotivo,
  type EstadoSolicitud,
  type SolicitudEliminacion,
} from '@/lib/moderacionResenas';

export const TEXTO_ESTADO: Record<EstadoSolicitud, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente de revisión', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  aprobada: { texto: 'Aprobada: reseña eliminada', clase: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
  rechazada: { texto: 'Rechazada', clase: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

/** Pedidos de eliminación del comercio. Se leen al entrar (sin consultas periódicas). */
export function useSolicitudesEliminacion(comercioId: string | undefined) {
  const [estado, setEstado] = useState<{ disponible: boolean; solicitudes: SolicitudEliminacion[] }>({ disponible: false, solicitudes: [] });
  const recargar = useCallback(async () => {
    if (!comercioId) return;
    setEstado(await cargarSolicitudesDeComercio(comercioId));
  }, [comercioId]);
  useEffect(() => {
    void recargar();
  }, [recargar]);
  return { ...estado, recargar };
}

/** Botón y formulario para pedir que el admin elimine una reseña. */
export const SolicitarEliminacionResena: React.FC<{ resenaId: string; pendiente: boolean; onEnviada: () => void }> = ({ resenaId, pendiente, onEnviada }) => {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (pendiente) {
    return <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${TEXTO_ESTADO.pendiente.clase}`}>Eliminación pedida: {TEXTO_ESTADO.pendiente.texto.toLowerCase()}</span>;
  }
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-[11px] font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1">
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Solicitar eliminación
      </button>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validarMotivo(motivo);
    if (!v.ok) return setError(v.error);
    setEnviando(true);
    setError('');
    const r = await solicitarEliminacion(resenaId, v.motivo);
    setEnviando(false);
    if (!r.ok) return setError(r.mensaje);
    setAbierto(false);
    setMotivo('');
    onEnviada();
  };

  return (
    <form onSubmit={enviar} className="space-y-2 p-3 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-800">
      <label htmlFor={`motivo-${resenaId}`} className="text-[11px] font-bold text-gray-700 dark:text-gray-200 block">
        ¿Por qué querés que se elimine? Un administrador lo va a revisar.
      </label>
      <textarea
        id={`motivo-${resenaId}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        required
        minLength={MOTIVO_MIN}
        maxLength={MOTIVO_MAX}
        rows={2}
        className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">{motivo.trim().length}/{MOTIVO_MAX}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1.5 border rounded-xl text-[11px] font-bold">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-600 font-semibold">{error}</p>}
    </form>
  );
};

/** Estado de todos los pedidos (las reseñas aprobadas ya no se ven, por eso se muestra la copia). */
export const ListaSolicitudesEliminacion: React.FC<{ solicitudes: SolicitudEliminacion[] }> = ({ solicitudes }) => {
  if (!solicitudes.length) return null;
  return (
    <div className="pt-3 border-t dark:border-gray-700 space-y-2">
      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200">Tus pedidos de eliminación</h4>
      <ul className="space-y-2">
        {solicitudes.map((s) => (
          <li key={s.id} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-gray-600 dark:text-gray-300 italic">“{s.resena_resumen ?? 'Reseña'}”</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${TEXTO_ESTADO[s.estado].clase}`}>{TEXTO_ESTADO[s.estado].texto}</span>
            </div>
            <p className="text-[11px] text-gray-500">Motivo: {s.motivo} · {fecha(s.created_at)}</p>
            {s.nota_admin && <p className="text-[11px] text-gray-600 dark:text-gray-300">Nota del administrador: {s.nota_admin}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
};
