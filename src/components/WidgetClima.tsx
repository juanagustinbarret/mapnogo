import React, { useEffect, useState } from 'react';
import { CloudSun, CloudRain, AlertTriangle, OctagonAlert, ShieldCheck, Wind, Zap } from 'lucide-react';
import { ENDPOINT_CLIMA, HORAS_AVISO_VIENTO, LICENCIA_MET, type ClimaData } from '@/lib/clima';
import { ENDPOINT_ALERTAS, URL_ALERTAS_SMN, textoVigencia, type AlertaSmn, type NivelAlerta } from '@/lib/alertasSmn';

const ESTILO_NIVEL: Record<NivelAlerta, { texto: string; clase: string; Icono: typeof AlertTriangle }> = {
  amarilla: { texto: 'Alerta Amarilla', clase: 'bg-yellow-300 text-gray-950', Icono: AlertTriangle },
  naranja: { texto: 'Alerta Naranja', clase: 'bg-orange-500 text-gray-950', Icono: AlertTriangle },
  roja: { texto: 'Alerta Roja', clase: 'bg-red-700 text-white', Icono: OctagonAlert },
};

export const WidgetClima: React.FC = () => {
  const [clima, setClima] = useState<ClimaData | null>(null);
  const [loading, setLoading] = useState(true);
  // null = cargando; 'error' = no se pudo consultar al SMN
  const [alertas, setAlertas] = useState<AlertaSmn[] | 'error' | null>(null);

  useEffect(() => {
    let vigente = true;
    const fetchClimaNogoya = async () => {
      try {
        // El servidor (/api/clima) consulta a MET Norway y devuelve el clima ya interpretado
        const res = await fetch(ENDPOINT_CLIMA);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = (await res.json()) as ClimaData;
        if (vigente && typeof datos?.temp === 'number') setClima(datos);
      } catch (err) {
        console.warn('No se pudo cargar el clima:', err);
      } finally {
        if (vigente) setLoading(false);
      }
    };

    fetchClimaNogoya();
    // Se actualiza cada 30 minutos si la página queda abierta
    const reloj = window.setInterval(fetchClimaNogoya, 30 * 60_000);
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    const fetchAlertas = async () => {
      try {
        // El servidor (/api/alertas) consulta el feed CAP del SMN y devuelve las alertas de Nogoyá
        const res = await fetch(ENDPOINT_ALERTAS);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = (await res.json()) as { alertas?: AlertaSmn[] };
        if (!Array.isArray(datos?.alertas)) throw new Error('Respuesta inválida');
        if (vigente) setAlertas(datos.alertas);
      } catch (err) {
        console.warn('No se pudieron cargar las alertas del SMN:', err);
        if (vigente) setAlertas('error');
      }
    };

    fetchAlertas();
    const reloj = window.setInterval(fetchAlertas, 10 * 60_000);
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, []);

  const hayAlerta = !!clima && (clima.alertaTormenta || clima.alertaViento);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* BADGE DEL CLIMA ADAPTADO A CELULAR Y ESCRITORIO */}
      {!loading && clima && (
        <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-xs font-semibold shadow-sm w-fit max-w-full">
          <div className="flex items-center gap-1.5 shrink-0">
            {clima.alertaTormenta ? (
              <Zap className="w-4 h-4 text-amber-300 motion-safe:animate-bounce" />
            ) : clima.esLluvia ? (
              <CloudRain className="w-4 h-4 text-blue-300 motion-safe:animate-bounce" />
            ) : (
              <CloudSun className="w-4 h-4 text-amber-300" />
            )}
            <span>
              Nogoyá: <strong className="text-sm font-black">{clima.temp}°C</strong>
            </span>
          </div>

          <span className="text-white/80">• ST: {clima.sensacion}°C</span>
          <span className="text-white/80">• Hum: {clima.humedad}%</span>

          {clima.vientoVelocidad > 0 && (
            <span className="text-white/80 flex items-center gap-1 shrink-0">
              • <Wind className="w-3 h-3 inline" /> {clima.vientoVelocidad} km/h
              {clima.direccionViento && ` del ${clima.direccionViento}`}
            </span>
          )}
        </div>
      )}

      {/* BANNER DE ALERTA AUTOMÁTICA EN CASO DE RIESGO */}
      {hayAlerta && clima && (
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-gray-950 font-black text-[11px] rounded-xl shadow-md motion-safe:animate-pulse w-fit"
          title="Aviso automático según el pronóstico de MET Norway (velocidad media, sin ráfagas). No es una alerta oficial del SMN."
        >
          <AlertTriangle className="w-3.5 h-3.5 text-gray-950 shrink-0" />
          <span>
            {clima.alertaTormenta
              ? 'Aviso: tormenta en la zona'
              : `Aviso: viento de hasta ${clima.vientoMaximo} km/h en las próximas ${HORAS_AVISO_VIENTO} h`}
          </span>
        </div>
      )}

      {/* ALERTAS OFICIALES DEL SMN (la más grave primero) */}
      {Array.isArray(alertas) &&
        alertas.map((a) => {
          const { texto, clase, Icono } = ESTILO_NIVEL[a.nivel];
          return (
            <div
              key={`${a.nivel}-${a.fenomeno}-${a.inicio}`}
              className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-3 py-1 ${clase} text-[11px] rounded-xl shadow-md w-fit max-w-full`}
              title={a.descripcion}
            >
              <Icono className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <strong className="font-black">{texto}:</strong>
              <span className="font-bold">{a.fenomeno}</span>
              <span>• {textoVigencia(a)}</span>
              {a.rafagas && <span>• Ráfagas de hasta {a.rafagas} km/h</span>}
              <a href={URL_ALERTAS_SMN} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                Fuente: SMN
              </a>
            </div>
          );
        })}
      {Array.isArray(alertas) && alertas.length === 0 && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-[11px] font-semibold rounded-xl w-fit">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Sin alertas vigentes</span>
          <a href={URL_ALERTAS_SMN} target="_blank" rel="noopener noreferrer" className="underline">
            Fuente: SMN
          </a>
        </div>
      )}
      {alertas === 'error' && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-[11px] font-semibold rounded-xl w-fit">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>No pudimos consultar las alertas.</span>
          <a href={URL_ALERTAS_SMN} target="_blank" rel="noopener noreferrer" className="underline">
            Ver en smn.gob.ar
          </a>
        </div>
      )}

      {/* Atribución que pide la licencia CC BY 4.0 de MET Norway */}
      {!loading && clima && (
        <a
          href={LICENCIA_MET}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-white/60 hover:text-white/90 w-fit"
        >
          Datos: MET Norway (CC BY 4.0)
        </a>
      )}
    </div>
  );
};
