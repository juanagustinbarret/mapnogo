import React, { useEffect, useState } from 'react';
import { Eye, MessageCircle, Navigation, TrendingUp } from 'lucide-react';
import { obtenerMetricasConComparacion } from '@/lib/metrics';
import { formatearNumero, variacion, type ValoresMetricas } from '@/lib/mensajeMetricas';
import { describirRango, type RangoFechas } from '@/lib/rangosFechas';
import { SelectorPeriodo, periodoDeAtajo, type Periodo } from '@/components/SelectorPeriodo';

// Importación por defecto con fallback para evitar discrepancias de export nombrado/default
import GraficoInteracciones from '@/components/panel/GraficoInteracciones';

const TARJETAS: Array<{ clave: keyof ValoresMetricas; titulo: string; ayuda: string; Icono: typeof Eye; color: string }> = [
  { clave: 'visitas', titulo: 'Visitas a la ficha', ayuda: 'Personas distintas que abrieron la ficha (cada visitante cuenta una vez cada 30 min).', Icono: Eye, color: 'text-blue-600' },
  { clave: 'whatsapp', titulo: 'Consultas por WhatsApp', ayuda: 'Toques en el botón de WhatsApp de la ficha o de una promoción.', Icono: MessageCircle, color: 'text-green-600' },
  { clave: 'comoLlegar', titulo: 'Pedidos de "Cómo llegar"', ayuda: 'Toques en "Cómo llegar" en la ficha o en el mapa.', Icono: Navigation, color: 'text-purple-600' },
];

export const PanelMetricas: React.FC<{ comercioId?: string; rangoInicial?: RangoFechas | null }> = ({
  comercioId,
  rangoInicial,
}) => {
  const [periodo, setPeriodo] = useState<Periodo>(() =>
    rangoInicial ? { atajo: 'personalizado', rango: rangoInicial } : periodoDeAtajo('30d'),
  );
  const [datos, setDatos] = useState<{ actual: ValoresMetricas; anterior: ValoresMetricas; rangoAnterior: RangoFechas } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    obtenerMetricasConComparacion(comercioId, periodo.rango)
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((e) => {
        console.error('[métricas] No se pudieron cargar', e);
        if (vigente) setError('No se pudieron cargar las métricas.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [comercioId, periodo.rango.desde, periodo.rango.hasta]);

  // Transformación limpia de los datos para el gráfico de Recharts
  const datosGrafico = datos
    ? [
        { fecha: 'Anterior', visitas: datos.anterior.visitas, whatsapp: datos.anterior.whatsapp },
        { fecha: 'Actual', visitas: datos.actual.visitas, whatsapp: datos.actual.whatsapp },
      ]
    : [];

  return (
    <div className="space-y-5">
      <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />

      {error ? (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
            {TARJETAS.map(({ clave, titulo, ayuda, Icono, color }) => {
              const valor = datos?.actual[clave] ?? 0;
              const comparacion = datos ? variacion(valor, datos.anterior[clave]) : '';
              return (
                <div key={clave} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700" title={ayuda}>
                  <Icono className={`w-5 h-5 ${color}`} aria-hidden="true" />
                  <p className="text-xs text-gray-500 mt-2">{titulo}</p>
                  <p className={`text-3xl font-black ${color}`}>{formatearNumero(valor)}</p>
                  {datos && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {comparacion} · antes {formatearNumero(datos.anterior[clave])} ({describirRango(datos.rangoAnterior)})
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* GRÁFICO VISUAL CON RECHARTS */}
          {datosGrafico.length > 0 && !cargando && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Comparativa Gráfica de Rendimiento
                </span>
              </div>
              <GraficoInteracciones data={datosGrafico} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PanelMetricas;