import React from 'react';
import { Tag, CalendarDays, ExternalLink, ArrowUpRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { textoVencimiento } from '@/lib/fechasArgentina';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { registrarInteraccion } from '@/lib/metrics';
import { InsigniaRubro } from '@/components/InsigniaRubro';

export interface PromocionItem {
  id: string;
  comercio_id?: string;
  titulo: string;
  descripcion: string;
  tipo: 'promocion' | 'novedad';
  precio_anterior?: number | null;
  precio_promocional?: number | null;
  fecha_fin?: string | null;
  imagen_url?: string | null;
  comercio?: {
    nombre: string;
    slug: string;
    whatsapp?: string | null;
    rubro?: any;
  };
}

interface Props {
  promo: PromocionItem;
}

export const OfertaCard: React.FC<Props> = ({ promo }) => {
  const comercio = promo.comercio;
  const whatsappLimpio = normalizeWhatsAppNumber(comercio?.whatsapp ?? '');

  // Cálculo del porcentaje de descuento
  const descuentoPorcentaje =
    promo.precio_anterior && promo.precio_promocional && promo.precio_anterior > promo.precio_promocional
      ? Math.round(((promo.precio_anterior - promo.precio_promocional) / promo.precio_anterior) * 100)
      : null;

  const vencInfo = promo.fecha_fin ? textoVencimiento(promo.fecha_fin) : null;

  const handleWhatsAppClick = () => {
    if (promo.comercio_id) {
      void registrarInteraccion(promo.comercio_id, 'whatsapp');
    }
  };

  const mensajeWsp = `Hola *${comercio?.nombre}*, vi la publicación "${promo.titulo}" en NOGOYORK y quiero consultar.`;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 hover:border-amber-500/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
      
      {/* IMAGEN DE LA OFERTA (SI EXISTE) */}
      {promo.imagen_url ? (
        <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
          <img
            src={promo.imagen_url}
            alt={promo.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-black/20" />
        </div>
      ) : null}

      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          
          {/* ENCABEZADO DE TARJETA: TIPO Y LOCAL */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                promo.tipo === 'novedad'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <Tag className="w-3 h-3" />
              {promo.tipo === 'novedad' ? 'Novedad' : 'Oferta Especial'}
            </span>

            {comercio && (
              <Link
                to={`/comercio/${comercio.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 px-2.5 py-1 rounded-xl transition border border-gray-200 dark:border-gray-600/50"
              >
                <InsigniaRubro rubro={comercio.rubro} />
                <span>{comercio.nombre}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />
              </Link>
            )}
          </div>

          {/* TÍTULO Y DESCRIPCIÓN */}
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {promo.titulo}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 leading-relaxed">
              {promo.descripcion}
            </p>
          </div>

          {/* INDICADOR DE VENCIMIENTO */}
          {vencInfo && vencInfo.texto && (
            <div
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                vencInfo.estaPorVencer
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                  : 'bg-gray-50 text-gray-600 dark:bg-gray-900/50 dark:text-gray-400 border-gray-200 dark:border-gray-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{vencInfo.texto}</span>
            </div>
          )}
        </div>

        {/* SECCIÓN PRECIO Y DESCUENTO TACHADO */}
        {(promo.precio_promocional || promo.precio_anterior) && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700/80 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              {promo.precio_promocional && (
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(promo.precio_promocional)}
                </span>
              )}
              {promo.precio_anterior && (
                <span className="text-xs font-bold text-gray-400 line-through">
                  {formatCurrency(promo.precio_anterior)}
                </span>
              )}
            </div>

            {descuentoPorcentaje && (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black rounded-lg">
                {descuentoPorcentaje}% OFF
              </span>
            )}
          </div>
        )}
      </div>

      {/* BOTÓN DE ACCIÓN PRINCIPAL */}
      <div className="p-5 pt-0">
        {whatsappLimpio.isValid ? (
          <a
            href={buildWhatsAppUrl(whatsappLimpio.normalized, mensajeWsp)}
            target="_blank"
            rel="noreferrer"
            onClick={handleWhatsAppClick}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition shadow-sm"
          >
            <MessageCircle className="w-4 h-4" /> Consultar por WhatsApp
          </a>
        ) : comercio ? (
          <Link
            to={`/comercio/${comercio.slug}`}
            className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition"
          >
            Ver Ficha del Comercio <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
};