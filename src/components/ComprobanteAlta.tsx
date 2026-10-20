import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, MessageCircle, Printer } from 'lucide-react';
import {
  MEDIOS_DE_ALTA,
  condicionesDelAlta,
  datosDelProveedor,
  numeroDeAlta,
  textoAceptacion,
  textoComprobante,
  textoPrecio,
  type DatosAlta,
} from '@/lib/comprobanteAlta';
import { formatearFecha, formatearFechaHora } from '@/lib/fechasArgentina';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';

/**
 * Comprobante de alta (ticket): lo que se firmó/aceptó al dar de alta el
 * comercio. "Imprimir" usa el diálogo del navegador, que también permite
 * guardarlo como PDF; al imprimir se oculta todo lo demás de la página.
 */
export const ComprobanteAlta: React.FC<{ datos: DatosAlta }> = ({ datos }) => {
  const [aviso, setAviso] = useState('');
  const numero = numeroDeAlta(datos.comercioId, datos.fecha);
  const texto = textoComprobante(datos);
  const tel = normalizeWhatsAppNumber(datos.whatsapp ?? '');
  const urlWhatsApp = `https://wa.me/${tel.isValid ? tel.normalized : ''}?text=${encodeURIComponent(texto)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Comprobante copiado.');
    } catch {
      setAviso('No se pudo copiar.');
    }
  };

  const fila = (etiqueta: string, valor?: React.ReactNode) =>
    valor ? (
      <div className="flex justify-between gap-3 py-1 border-b border-dashed border-gray-300 last:border-0">
        <dt className="text-gray-500 shrink-0">{etiqueta}</dt>
        <dd className="font-semibold text-right break-words min-w-0">{valor}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex items-center gap-2 p-3 rounded-2xl bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 text-sm font-bold" role="status">
        <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" /> Comercio dado de alta. Este es el comprobante del contrato.
      </div>

      {/* El ticket: siempre en blanco y negro para que se imprima bien */}
      <article id="ticket-alta" className="ticket-imprimible mx-auto max-w-sm bg-white text-gray-900 border border-gray-300 rounded-2xl p-5 font-mono text-[12px] leading-snug shadow-sm" aria-label="Comprobante de alta">
        <header className="text-center space-y-0.5 border-b-2 border-gray-900 pb-2 mb-2">
          <p className="text-base font-black tracking-wide">NOGOMAP</p>
          <p className="font-bold">COMPROBANTE DE ALTA</p>
          <p>Contrato de suscripción · Ley 24.240</p>
          <p className="font-bold">N° {numero}</p>
          <p>{formatearFechaHora(datos.fecha.toISOString())}</p>
        </header>

        <dl>
          {fila('Comercio', datos.comercio)}
          {fila('Rubro', datos.rubro)}
          {fila('Dirección', datos.direccion)}
          {fila('Titular', datos.titular)}
          {fila('DNI / CUIT', datos.documento)}
          {fila('Usuario', datos.email)}
          {fila('WhatsApp', datos.whatsapp)}
          {fila('Plan', datos.plan ?? 'Suscripción mensual')}
          {fila('Precio', textoPrecio(datos.precioMensual))}
          {fila('1er vencimiento', formatearFecha(datos.primerVencimiento))}
          {fila('Alta', MEDIOS_DE_ALTA[datos.medio])}
        </dl>

        <p className="font-bold mt-3 mb-1">Condiciones principales</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {condicionesDelAlta(datos).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <p className="mt-3 font-semibold">{textoAceptacion()}</p>
        <p className="mt-1">Texto completo: mapnogo.vercel.app/terminos</p>

        <div className="grid grid-cols-2 gap-4 mt-8 text-center">
          <div className="border-t border-gray-900 pt-1">Firma del titular</div>
          <div className="border-t border-gray-900 pt-1">Por NOGOMAP</div>
        </div>

        <footer className="mt-4 pt-2 border-t border-gray-300 text-[11px] text-gray-600">
          Proveedor: {datosDelProveedor()}
        </footer>
      </article>

      <div className="no-imprimir flex flex-wrap gap-2 justify-center">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white">
          <Printer className="w-4 h-4" aria-hidden="true" /> Imprimir o guardar PDF
        </button>
        <a href={urlWhatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
          <MessageCircle className="w-4 h-4" aria-hidden="true" /> Mandárselo por WhatsApp
        </a>
        <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white">
          <Copy className="w-4 h-4" aria-hidden="true" /> Copiar
        </button>
        <Link to="/admin" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white">
          Ir al panel
        </Link>
      </div>
      <p className="no-imprimir text-center text-xs text-gray-500 min-h-[1em]" aria-live="polite">
        {aviso || 'Guardá una copia: el comprobante no queda guardado en la base.'}
      </p>
    </div>
  );
};
