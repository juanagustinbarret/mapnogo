import React, { useEffect, useState } from 'react';
import { Comercio } from '@/types/database.types';
import { obtenerMetricasConComparacion } from '@/lib/metrics';
import { armarMensajeMetricas, urlDetalleMetricas, valoresMensajeMetricas } from '@/lib/mensajeMetricas';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { PLANTILLAS_PREDETERMINADAS } from '@/lib/plantillasMensajes';
import { SelectorPeriodo, periodoDeAtajo, type Periodo } from '@/components/SelectorPeriodo';
import { EditorMensajeWhatsApp } from '@/components/EditorMensajeWhatsApp';

// Métricas por WhatsApp: se elige el período, se arma el mensaje con la
// plantilla de Configuración y se puede editar antes de abrir WhatsApp.
export const ModalMetricasWhatsApp: React.FC<{
  comercio: Comercio;
  plantilla?: string;
  onCerrar: () => void;
}> = ({ comercio, plantilla = PLANTILLAS_PREDETERMINADAS.metricas, onCerrar }) => {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAtajo('7d'));
  const [texto, setTexto] = useState('');
  const [valores, setValores] = useState<Record<string, string | undefined>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const telefono = normalizeWhatsAppNumber(comercio.whatsapp);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    obtenerMetricasConComparacion(comercio.id, periodo.rango)
      .then(({ actual, anterior, rango }) => {
        if (!vigente) return;
        const datos = {
          nombreComercio: comercio.nombre,
          rango,
          actual,
          anterior,
          urlDetalle: urlDetalleMetricas(window.location.origin, rango),
        };
        setValores(valoresMensajeMetricas(datos));
        setTexto(armarMensajeMetricas(datos, plantilla).texto);
      })
      .catch((e) => {
        console.error('[métricas] No se pudieron leer', e);
        if (vigente) setError('No se pudieron leer las métricas. No se va a enviar nada.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [comercio.id, comercio.nombre, periodo.rango.desde, periodo.rango.hasta, plantilla]);

  return (
    <EditorMensajeWhatsApp
      titulo={`Métricas para ${comercio.nombre}`}
      tipo="metricas"
      textoInicial={error ? '' : texto}
      valores={valores}
      telefono={telefono.isValid ? telefono.normalized : ''}
      cargando={cargando}
      aviso={error || (!telefono.isValid ? 'El comercio no tiene un WhatsApp válido cargado.' : undefined)}
      encabezado={<SelectorPeriodo valor={periodo} onCambio={setPeriodo} />}
      onCerrar={onCerrar}
    />
  );
};
