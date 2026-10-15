import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, MessageCircle, Store } from 'lucide-react';
import { Promocion } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { listarPromocionesVigentes } from '@/services/promociones';
import { registrarInteraccion } from '@/services/metricas';
import { CIUDAD, NOMBRE_APP } from '@/config/marca';

export const PromotionsPage: React.FC = () => {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listarPromocionesVigentes()
      .then(setPromociones)
      .catch((e) => {
        console.error(e);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="w-6 h-6 text-amber-500" aria-hidden="true" /> Promociones y Ofertas en {CIUDAD}
        </h1>
        <p className="text-sm text-gray-500">Aprovechá los descuentos de los comercios locales adheridos.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Cargando promociones vigentes...</div>
      ) : error ? (
        <div className="p-12 text-center text-red-600 font-semibold">No pudimos cargar las promociones. Probá recargar la página.</div>
      ) : promociones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl text-center text-gray-500 border">
          <Tag className="w-12 h-12 mx-auto mb-2 opacity-40 text-amber-500" aria-hidden="true" />
          <p>No hay promociones activas en este momento. ¡Volvé a consultar pronto!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promociones.map((p) => {
            const whatsappUrl = p.comercio
              ? buildWhatsAppUrl(p.comercio.whatsapp, `Hola, vi la promoción "${p.titulo}" en ${NOMBRE_APP} y quiero consultar.`)
              : null;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:border-amber-500 transition space-y-3 p-5"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                    {p.destacada ? 'Destacada' : 'Oferta Especial'}
                  </span>
                  {p.comercio && (
                    <Link
                      to={`/comercio/${p.comercio.slug}`}
                      className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Store className="w-3.5 h-3.5" aria-hidden="true" /> {p.comercio.nombre}
                    </Link>
                  )}
                </div>

                <h2 className="font-bold text-lg text-gray-900 dark:text-white">{p.titulo}</h2>
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{p.descripcion}</p>

                {(p.precio_promocional || p.precio_anterior) && (
                  <div className="flex items-baseline gap-2 pt-2">
                    {p.precio_promocional && (
                      <span className="text-2xl font-bold text-green-600">{formatCurrency(p.precio_promocional)}</span>
                    )}
                    {p.precio_anterior && (
                      <span className="text-sm text-gray-400 line-through">{formatCurrency(p.precio_anterior)}</span>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-gray-400">Válida hasta el {formatDate(p.fecha_fin)}</p>

                {whatsappUrl && p.comercio && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void registrarInteraccion(p.comercio!.id, 'whatsapp')}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition mt-2"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" /> Consultar al Comercio por WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
