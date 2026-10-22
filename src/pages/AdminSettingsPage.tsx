import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, RotateCcw, Save, Settings } from 'lucide-react';
import {
  PLANTILLAS_PREDETERMINADAS,
  TITULOS_PLANTILLAS,
  VARIABLES,
  VARIABLES_POR_TIPO,
  completarPlantilla,
  leerPlantillasGuardadas,
  validarPlantilla,
  type TipoPlantilla,
} from '@/lib/plantillasMensajes';
import { PruebaNotificaciones } from '@/components/PruebaNotificaciones';

const TIPOS: TipoPlantilla[] = ['recordatorio_pago', 'invitacion_suscripcion', 'metricas'];

const DESCRIPCIONES: Record<TipoPlantilla, string> = {
  recordatorio_pago: 'Se usa en Vencimientos → "Recordatorio" para comercios con suscripción.',
  invitacion_suscripcion: 'Se usa en Vencimientos para comercios sin suscripción cargada (no lleva importe).',
  metricas: 'Se usa en Vencimientos → "Enviar Métricas".',
};

const ejemplos = Object.fromEntries(Object.values(VARIABLES).map((v) => [v.clave, v.ejemplo]));

// Plantillas generales de los mensajes de WhatsApp. Se guardan en
// configuracion_sistema (clave plantillas_whatsapp), junto a lo que ya hubiera.
export const AdminSettingsPage: React.FC = () => {
  const [plantillas, setPlantillas] = useState<Record<TipoPlantilla, string>>(PLANTILLAS_PREDETERMINADAS);
  const [guardadoOriginal, setGuardadoOriginal] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const areas = useRef<Partial<Record<TipoPlantilla, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    void cargarConfig();
  }, []);

  const cargarConfig = async () => {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', 'plantillas_whatsapp')
      .maybeSingle();
    if (error) {
      setEstado({ tipo: 'error', texto: `No se pudieron leer las plantillas: ${error.message}` });
      return;
    }
    const valor = (data?.valor ?? {}) as Record<string, unknown>;
    setGuardadoOriginal(valor);
    setPlantillas(leerPlantillasGuardadas(valor));
  };

  const validaciones = Object.fromEntries(TIPOS.map((t) => [t, validarPlantilla(plantillas[t], t)])) as Record<
    TipoPlantilla,
    ReturnType<typeof validarPlantilla>
  >;
  const hayErrores = TIPOS.some((t) => validaciones[t].errores.length > 0);

  const insertar = (tipo: TipoPlantilla, clave: string) => {
    const el = areas.current[tipo];
    const token = `{${clave}}`;
    const texto = plantillas[tipo];
    const inicio = el?.selectionStart ?? texto.length;
    const fin = el?.selectionEnd ?? texto.length;
    setPlantillas({ ...plantillas, [tipo]: texto.slice(0, inicio) + token + texto.slice(fin) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + token.length, inicio + token.length);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hayErrores) return;
    setLoading(true);
    setEstado(null);

    // Se conservan las demás claves que ya hubiera (por ejemplo las plantillas
    // viejas proximo_vencimiento / pago_vencido).
    const { error } = await supabase.from('configuracion_sistema').upsert({
      clave: 'plantillas_whatsapp',
      valor: { ...guardadoOriginal, ...plantillas },
      updated_at: new Date().toISOString(),
    });

    setLoading(false);
    if (error) {
      console.error('[configuración] No se pudieron guardar las plantillas', error);
      setEstado({ tipo: 'error', texto: `No se pudieron guardar: ${error.message}` });
    } else {
      setGuardadoOriginal({ ...guardadoOriginal, ...plantillas });
      setEstado({ tipo: 'ok', texto: '¡Plantillas guardadas!' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Settings className="w-6 h-6 text-brand-600" /> Mensajes de WhatsApp
      </h1>
      <p className="text-xs text-gray-500">
        Tocá un dato para insertarlo donde está el cursor. Antes de cada envío vas a poder ajustar el mensaje de ese comercio.
      </p>

      {estado && (
        <div
          role="status"
          className={`p-3 rounded-lg text-sm font-semibold ${
            estado.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {estado.texto}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {TIPOS.map((tipo) => {
          const { errores, advertencias } = validaciones[tipo];
          const vistaPrevia = completarPlantilla(plantillas[tipo], ejemplos).texto;
          return (
            <section
              key={tipo}
              className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" /> {TITULOS_PLANTILLAS[tipo]}
                  </h2>
                  <p className="text-xs text-gray-500">{DESCRIPCIONES[tipo]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlantillas({ ...plantillas, [tipo]: PLANTILLAS_PREDETERMINADAS[tipo] })}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar mensaje predeterminado
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {VARIABLES_POR_TIPO[tipo].map((clave) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => insertar(tipo, clave)}
                    className="px-2 py-1 rounded-full text-[11px] font-semibold border border-brand-600/40 text-brand-700 dark:text-brand-100 bg-brand-50 dark:bg-brand-900/40"
                    title={`Inserta {${clave}}`}
                  >
                    {VARIABLES[clave].etiqueta}
                  </button>
                ))}
              </div>

              <textarea
                ref={(el) => {
                  areas.current[tipo] = el;
                }}
                aria-label={`Plantilla: ${TITULOS_PLANTILLAS[tipo]}`}
                rows={6}
                value={plantillas[tipo]}
                onChange={(e) => setPlantillas({ ...plantillas, [tipo]: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />

              {errores.map((er) => (
                <p key={er} className="text-xs font-semibold text-red-600" role="alert">
                  {er}
                </p>
              ))}
              {advertencias.map((ad) => (
                <p key={ad} className="text-xs text-amber-700 dark:text-amber-300">
                  {ad}
                </p>
              ))}

              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1">Vista previa (con datos de ejemplo):</p>
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-xs whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                  {vistaPrevia}
                </div>
              </div>
            </section>
          );
        })}

        <button
          type="submit"
          disabled={loading || hayErrores}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {loading ? 'Guardando...' : hayErrores ? 'Corregí los errores para guardar' : 'Guardar Plantillas'}
        </button>
      </form>

      <PruebaNotificaciones />
    </div>
  );
};
