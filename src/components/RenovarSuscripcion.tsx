import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Store, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { estadoSuscripcion, urlRenovacion, type NegocioParaRenovar } from '@/lib/renovacion';
import { formatCurrency } from '@/lib/formatters';
import { formatearFecha } from '@/lib/fechasArgentina';
import { whatsappLegible } from '@/lib/contacto';

interface Props {
  propietarioId?: string;
  /** El negocio que ya está abierto en el panel (se usa si no se puede leer la lista). */
  actual: NegocioParaRenovar;
}

/**
 * Botón "Renovar suscripción": el comercio elige su negocio y va al WhatsApp
 * del administrador con el mensaje listo. El envío lo hace el comercio desde
 * WhatsApp; acá no se registra ningún pago.
 */
export const RenovarSuscripcion: React.FC<Props> = ({ propietarioId, actual }) => {
  const [abierto, setAbierto] = useState(false);
  const [negocios, setNegocios] = useState<NegocioParaRenovar[]>([actual]);
  const [elegido, setElegido] = useState(actual.id);
  const [cargando, setCargando] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  // Al abrir: todos los negocios del mismo dueño, con su plan y vencimiento
  useEffect(() => {
    if (!abierto || !propietarioId) return;
    let vigente = true;
    setCargando(true);
    (async () => {
      const { data: comercios } = await supabase
        .from('comercios')
        .select('id, nombre, direccion')
        .eq('propietario_id', propietarioId)
        .order('nombre');
      const lista = (comercios ?? []) as { id: string; nombre: string; direccion?: string | null }[];
      type Sub = { comercio_id: string; precio_acordado?: number; proximo_vencimiento?: string; estado?: string };
      let porComercio: Record<string, Sub> = {};
      if (lista.length > 0) {
        const { data: subs } = await supabase
          .from('suscripciones')
          .select('comercio_id, precio_acordado, proximo_vencimiento, estado')
          .in('comercio_id', lista.map((c) => c.id));
        porComercio = Object.fromEntries(((subs ?? []) as Sub[]).map((s) => [s.comercio_id, s]));
      }
      if (!vigente) return;
      const armados = lista.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        direccion: c.direccion,
        precio: porComercio[c.id]?.precio_acordado ?? null,
        vencimiento: porComercio[c.id]?.proximo_vencimiento ?? null,
        estado: porComercio[c.id]?.estado ?? null,
      }));
      // Si la lista no se pudo leer, queda el negocio abierto en el panel
      if (armados.length > 0) {
        setNegocios(armados);
        setElegido((id) => (armados.some((n) => n.id === id) ? id : armados[0].id));
      }
      setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, [abierto, propietarioId]);

  const negocio = negocios.find((n) => n.id === elegido) ?? negocios[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" /> Renovar suscripción
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-renovar"
          onClick={(e) => e.target === e.currentTarget && setAbierto(false)}
        >
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-renovar" className="text-lg font-black text-gray-900 dark:text-white">Renovar suscripción</h2>
                <p className="text-xs text-gray-500">Elegí tu negocio y te llevamos al WhatsApp del administrador ({whatsappLegible()}).</p>
              </div>
              <button ref={cerrarRef} type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="p-2 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tu negocio {cargando && <span className="font-normal text-gray-400">(cargando…)</span>}</legend>
              {negocios.map((n) => {
                const estado = estadoSuscripcion(n.estado);
                return (
                  <label
                    key={n.id}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      n.id === elegido ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <input type="radio" name="negocio" value={n.id} checked={n.id === elegido} onChange={() => setElegido(n.id)} className="mt-1 accent-emerald-600" />
                    <span className="flex-1 min-w-0 space-y-0.5">
                      <span className="flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-white">
                        <Store className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span className="truncate">{n.nombre}</span>
                      </span>
                      {n.direccion && <span className="block text-xs text-gray-500 truncate">{n.direccion}</span>}
                      <span className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${estado.clase}`}>{estado.texto}</span>
                        {n.precio != null && <span>{formatCurrency(Number(n.precio))}/mes</span>}
                        {n.vencimiento && <span>Vence {formatearFecha(n.vencimiento)}</span>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <a
              href={urlRenovacion(negocio)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAbierto(false)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" /> Ir al WhatsApp del administrador
            </a>
            <p className="text-[11px] text-center text-gray-500">El mensaje sale con el nombre y el código de tu negocio. Lo mandás vos desde WhatsApp.</p>
          </div>
        </div>
      )}
    </>
  );
};
