import React, { useEffect, useState } from 'react';
import { registrarInteraccion } from '@/lib/metrics';
import { supabase } from '@/lib/supabase';
import { Promocion } from '@/types/database.types';
import { formatCurrency } from '@/lib/formatters';
import { hoyArgentina, textoVencimiento } from '@/lib/fechasArgentina';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { CalendarDays, Tag, MessageCircle, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PromotionsPage: React.FC = () => {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Antes se listaban todas las promociones aprobadas, incluso las vencidas
    // y las de comercios dados de baja. Ahora solo las vigentes hoy (en hora
    // de Argentina) de comercios aprobados y habilitados.
    const hoy = hoyArgentina();
    supabase
      .from('promociones')
      .select('*, comercio:comercios!inner(*)')
      .eq('aprobada', true)
      .gte('fecha_fin', hoy)
      .lte('fecha_inicio', hoy)
      .eq('comercio.aprobado', true)
      .eq('comercio.habilitado_admin', true)
      .order('fecha_fin', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[promociones] No se pudieron cargar', error);
        if (data) setPromociones(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="w-6 h-6 text-amber-500" /> Promociones y Ofertas en Nogoyá
        </h1>
        <p className="text-sm text-gray-500">Aprovechá los descuentos exclusivos de los comercios locales adheridos.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Cargando promociones vigentes...</div>
      ) : promociones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl text-center text-gray-500 border">
          <Tag className="w-12 h-12 mx-auto mb-2 opacity-40 text-amber-500" />
          <p>No hay promociones activas en este momento. ¡Volvé a consultar pronto!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promociones.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:border-amber-500 transition space-y-3 p-5">
              <div className="flex justify-between items-start">
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  {p.tipo === 'novedad' ? 'Novedad' : 'Oferta Especial'}
                </span>
                <Link to={`/comercio/${p.comercio?.slug}`} className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:underline">
                  <Store className="w-3.5 h-3.5" /> {p.comercio?.nombre}
                </Link>
              </div>

              <h3 className="font-bold text-lg text-gray-900 dark:text-white">{p.titulo}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{p.descripcion}</p>
              {p.fecha_fin && (
                <p
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    textoVencimiento(p.fecha_fin).estaPorVencer ? 'text-amber-600' : 'text-gray-500'
                  }`}
                >
                  <CalendarDays className="w-3 h-3" /> {textoVencimiento(p.fecha_fin).texto}
                </p>
              )}

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

              <a
                href={buildWhatsAppUrl(
                  normalizeWhatsAppNumber(p.comercio?.whatsapp ?? '').normalized,
                  `Hola, vi la promoción "${p.titulo}" en NOGOMAP y quiero consultar.`
                )}
                target="_blank"
                rel="noreferrer"
                // Antes las consultas desde Promociones no se contaban
                onClick={() => p.comercio_id && void registrarInteraccion(p.comercio_id, 'whatsapp')}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition mt-2"
              >
                <MessageCircle className="w-4 h-4" /> Consultar al Comercio por WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};