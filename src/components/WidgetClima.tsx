import React, { useEffect, useState } from 'react';
import { CloudSun, CloudRain, AlertTriangle, Wind, Zap } from 'lucide-react';
import { ENDPOINT_CLIMA, LICENCIA_MET, type ClimaData } from '@/lib/clima';

export const WidgetClima: React.FC = () => {
  const [clima, setClima] = useState<ClimaData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !clima) return null;

  const hayAlerta = clima.alertaTormenta || clima.alertaViento;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* BADGE DEL CLIMA ADAPTADO A CELULAR Y ESCRITORIO */}
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
          </span>
        )}
      </div>

      {/* BANNER DE ALERTA AUTOMÁTICA EN CASO DE RIESGO */}
      {hayAlerta && (
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-gray-950 font-black text-[11px] rounded-xl shadow-md motion-safe:animate-pulse w-fit"
          title="Aviso automático según el pronóstico de MET Norway. No es una alerta oficial del SMN."
        >
          <AlertTriangle className="w-3.5 h-3.5 text-gray-950 shrink-0" />
          <span>
            {clima.alertaTormenta
              ? 'Aviso: tormenta en la zona'
              : `Aviso: vientos fuertes (${Math.max(clima.vientoVelocidad, clima.rafagas)} km/h)`}
          </span>
        </div>
      )}

      {/* Atribución que pide la licencia CC BY 4.0 de MET Norway */}
      <a
        href={LICENCIA_MET}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-white/60 hover:text-white/90 w-fit"
      >
        Datos del clima: MET Norway (CC BY 4.0)
      </a>
    </div>
  );
};
