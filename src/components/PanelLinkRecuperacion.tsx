import React, { useState } from 'react';
import { Copy, Mail, MessageCircle, X } from 'lucide-react';
import { urlGmail, urlMailto, urlWhatsAppRecuperacion } from '@/lib/linksRecuperacion';

interface Props {
  link: string;
  email?: string | null;
  whatsapp?: string | null;
  /** Hora en que vence ("14:35"). */
  vence: string;
  /** Se llama cuando el admin toca un botón de envío (para marcar el pedido como resuelto). */
  onEnviado?: () => void;
  onCerrar: () => void;
}

/**
 * Link de recuperación ya creado, con un botón por canal. Cada botón es un
 * enlace común: Safari del iPhone lo deja abrir porque es un toque nuevo.
 */
export const PanelLinkRecuperacion: React.FC<Props> = ({ link, email, whatsapp, vence, onEnviado, onCerrar }) => {
  const [copiado, setCopiado] = useState('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado('Link copiado.');
    } catch {
      setCopiado('No se pudo copiar: mantené apretado el link de abajo para copiarlo.');
    }
  };

  const boton = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm';
  const externo = { target: '_blank', rel: 'noopener noreferrer' } as const;

  return (
    <div className="w-full mt-2 p-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 space-y-2" role="region" aria-label="Link de recuperación listo para enviar">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
          Link listo. Vence a las {vence} (15 minutos). Elegí cómo mandarlo:
        </p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300 rounded-lg shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={urlWhatsAppRecuperacion(whatsapp, link)} {...externo} onClick={onEnviado} className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white`}>
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
        </a>
        {email && (
          <>
            <a href={urlGmail(email, link)} {...externo} onClick={onEnviado} className={`${boton} bg-amber-600 hover:bg-amber-700 text-white`}>
              <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Gmail
            </a>
            <a href={urlMailto(email, link)} onClick={onEnviado} className={`${boton} bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200`}>
              <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Otra app de correo
            </a>
          </>
        )}
        <button type="button" onClick={copiar} className={`${boton} bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200`}>
          <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar link
        </button>
      </div>

      {!whatsapp && <p className="text-[11px] text-amber-800 dark:text-amber-300">El comercio no tiene WhatsApp cargado: WhatsApp te va a pedir que elijas el contacto.</p>}
      <p className="text-[11px] text-gray-600 dark:text-gray-400 break-all select-all">{link}</p>
      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 min-h-[1em]" aria-live="polite">{copiado}</p>
    </div>
  );
};
