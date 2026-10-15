import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Tag, Trash2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { Promocion } from '@/types/database.types';
import { formatCurrency, formatDate, mensajeError } from '@/lib/formatters';
import {
  cambiarAprobacionPromocion,
  eliminarPromocion,
  estaVigente,
  listarPromocionesAdmin,
} from '@/services/promociones';

// Moderación: las promociones se publican al instante y el admin puede ocultarlas
export const AdminPromotionsPage: React.FC = () => {
  const { avisar, confirmar } = useToast();
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setPromos(await listarPromocionesAdmin());
    } catch (e) {
      avisar(`No se pudieron cargar las promociones: ${mensajeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [avisar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async (p: Promocion) => {
    try {
      await cambiarAprobacionPromocion(p.id, !p.aprobada);
      avisar(p.aprobada ? 'Promoción oculta.' : 'Promoción visible otra vez.', 'exito');
      await cargar();
    } catch (e) {
      avisar(`No se pudo actualizar: ${mensajeError(e)}`, 'error');
    }
  };

  const borrar = async (p: Promocion) => {
    const ok = await confirmar({
      titulo: 'Eliminar promoción',
      mensaje: `¿Eliminar "${p.titulo}" de ${p.comercio?.nombre ?? 'este comercio'}?`,
      textoConfirmar: 'Eliminar',
      peligroso: true,
    });
    if (!ok) return;
    try {
      await eliminarPromocion(p.id);
      await cargar();
    } catch (e) {
      avisar(`No se pudo eliminar: ${mensajeError(e)}`, 'error');
    }
  };

  const visibles = soloVigentes ? promos.filter(estaVigente) : promos;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" aria-hidden="true" /> Promociones
          </h2>
          <p className="text-xs text-gray-500 mt-1">Se publican al instante. Ocultá las que no correspondan.</p>
        </div>
        <label className="text-xs font-semibold inline-flex items-center gap-2">
          <input type="checkbox" checked={soloVigentes} onChange={(e) => setSoloVigentes(e.target.checked)} />
          Solo vigentes
        </label>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="p-12 text-center text-gray-500">No hay promociones para mostrar.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">
                <th className="p-4">Promoción</th>
                <th className="p-4">Comercio</th>
                <th className="p-4">Vigencia</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td className="p-4">
                    <p className="font-bold text-gray-900 dark:text-white">{p.titulo}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{p.descripcion}</p>
                    {p.precio_promocional && <p className="text-xs font-bold text-green-600">{formatCurrency(p.precio_promocional)}</p>}
                  </td>
                  <td className="p-4 text-xs font-semibold">{p.comercio?.nombre ?? '—'}</td>
                  <td className="p-4 text-xs">
                    {formatDate(p.fecha_inicio)} al {formatDate(p.fecha_fin)}
                    {!estaVigente(p) && <span className="block text-gray-400">Vencida</span>}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.aprobada ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {p.aprobada ? 'Visible' : 'Oculta'}
                    </span>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap space-x-1">
                    <button
                      onClick={() => void alternar(p)}
                      className="p-2 text-gray-600 hover:text-brand-600 rounded-lg"
                      aria-label={p.aprobada ? `Ocultar ${p.titulo}` : `Mostrar ${p.titulo}`}
                      title={p.aprobada ? 'Ocultar' : 'Mostrar'}
                    >
                      {p.aprobada ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => void borrar(p)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
                      aria-label={`Eliminar ${p.titulo}`}
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
