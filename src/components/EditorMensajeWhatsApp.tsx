import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageCircle, X } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import {
  LARGO_MAXIMO,
  VARIABLES,
  VARIABLES_POR_TIPO,
  quitarVariable,
  variablesSinResolver,
  type TipoPlantilla,
} from '@/lib/plantillasMensajes';

interface EditorMensajeWhatsAppProps {
  titulo: string;
  tipo: TipoPlantilla;
  /** Mensaje ya armado para este comercio (puede traer {variables} sin dato). */
  textoInicial: string;
  /** Valores disponibles para insertar con los chips. */
  valores: Record<string, string | undefined>;
  /** Número normalizado (549...). */
  telefono: string;
  aviso?: string;
  cargando?: boolean;
  /** Controles extra arriba del mensaje (por ejemplo, el selector de período). */
  encabezado?: React.ReactNode;
  onCerrar: () => void;
}

// Editor del mensaje antes de abrir WhatsApp: se puede cambiar el texto,
// insertar variables con un toque y completar a mano las que no tienen dato.
// Solo se bloquea el envío si quedan {variables} sin resolver. No envía nada:
// abre WhatsApp con el texto y el admin decide.
export const EditorMensajeWhatsApp: React.FC<EditorMensajeWhatsAppProps> = ({
  titulo,
  tipo,
  textoInicial,
  valores,
  telefono,
  aviso,
  cargando = false,
  encabezado,
  onCerrar,
}) => {
  const [texto, setTexto] = useState(textoInicial);
  const [manuales, setManuales] = useState<Record<string, string>>({});
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setTexto(textoInicial), [textoInicial]);

  const sinResolver = variablesSinResolver(texto);

  const insertar = (clave: string) => {
    const valor = valores[clave] ?? `{${clave}}`;
    const el = area.current;
    if (!el) return setTexto((t) => t + valor);
    const inicio = el.selectionStart ?? texto.length;
    const fin = el.selectionEnd ?? texto.length;
    const nuevo = texto.slice(0, inicio) + valor + texto.slice(fin);
    setTexto(nuevo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + valor.length, inicio + valor.length);
    });
  };

  const completar = (clave: string) => {
    const valor = (manuales[clave] ?? '').trim();
    if (!valor) return;
    setTexto((t) => t.split(`{${clave}}`).join(valor));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="titulo-editor-mensaje">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-editor-mensaje" className="text-base font-bold text-gray-900 dark:text-white">{titulo}</h3>
            <p className="text-xs text-gray-500">Revisá y editá el mensaje. Recién cuando toques "Abrir WhatsApp" se abre el chat.</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {encabezado}

        {aviso && (
          <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {aviso}
          </p>
        )}

        {/* Variables sin dato: completar a mano o quitarlas del mensaje */}
        {sinResolver.map((clave) => (
          <div key={clave} className="p-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 space-y-2">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
              Falta el dato de <code>{`{${clave}}`}</code> ({VARIABLES[clave]?.etiqueta ?? clave})
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={manuales[clave] ?? ''}
                onChange={(e) => setManuales((m) => ({ ...m, [clave]: e.target.value }))}
                placeholder={`Ej.: ${VARIABLES[clave]?.ejemplo ?? ''}`}
                aria-label={`Completar ${VARIABLES[clave]?.etiqueta ?? clave}`}
                className="flex-1 min-w-[8rem] px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs dark:bg-gray-900"
              />
              <button type="button" onClick={() => completar(clave)} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold">
                Completar
              </button>
              <button
                type="button"
                onClick={() => setTexto((t) => quitarVariable(t, clave))}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold"
              >
                Quitar del mensaje
              </button>
            </div>
          </div>
        ))}

        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-1">Insertar dato:</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES_POR_TIPO[tipo].map((clave) => (
              <button
                key={clave}
                type="button"
                onClick={() => insertar(clave)}
                title={valores[clave] ? `Inserta: ${valores[clave]}` : 'Sin dato: se inserta la variable para completar'}
                className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
                  valores[clave]
                    ? 'border-brand-600/40 text-brand-700 dark:text-brand-100 bg-brand-50 dark:bg-brand-900/40'
                    : 'border-gray-300 dark:border-gray-600 text-gray-500'
                }`}
              >
                {VARIABLES[clave].etiqueta}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={area}
          aria-label="Mensaje"
          value={cargando ? 'Calculando…' : texto}
          readOnly={cargando}
          onChange={(e) => setTexto(e.target.value)}
          rows={9}
          className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs dark:bg-gray-900 dark:text-gray-100"
        />
        <p className={`text-[11px] text-right ${texto.length > LARGO_MAXIMO ? 'text-red-600' : 'text-gray-400'}`}>
          {texto.length} / {LARGO_MAXIMO}
        </p>

        {sinResolver.length > 0 && (
          <p className="text-xs font-semibold text-red-600" role="alert">
            No se puede abrir WhatsApp: faltan {sinResolver.map((v) => `{${v}}`).join(', ')}.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 border dark:border-gray-600 rounded-xl text-xs font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={cargando || !telefono || !texto.trim() || sinResolver.length > 0 || texto.length > LARGO_MAXIMO}
            onClick={() => {
              window.open(buildWhatsAppUrl(telefono, texto), '_blank', 'noopener');
              onCerrar();
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
