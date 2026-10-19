import React, { useEffect, useState } from 'react';
import { CloudSun, CloudRain, AlertTriangle, Wind, Zap } from 'lucide-react';

interface ClimaData {
  temp: number;
  sensacion: number;
  humedad: number;
  vientoVelocidad: number;
  lluvia: number;
  descripcion: string;
  esLluvia: boolean;
  alertaViento: boolean;
  alertaTormenta: boolean;
}

export const WidgetClima: React.FC = () => {
  const [clima, setClima] = useState<ClimaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClimaNogoya = async () => {
      try {
        // Coordenadas de Nogoyá, Entre Ríos (-32.3942, -59.7881)
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-32.3942&longitude=-59.7881&current=temperature_2m,relative_humidity_2m,apparent_temperature,rain,wind_speed_10m&timezone=America%2FArgentina%2FBuenos_Aires'
        );
        const data = await res.json();

        if (data?.current) {
          const temp = Math.round(data.current.temperature_2m);
          const sensacion = Math.round(data.current.apparent_temperature);
          const humedad = data.current.relative_humidity_2m;
          const lluvia = data.current.rain || 0;
          const vientoVelocidad = Math.round(data.current.wind_speed_10m || 0);

          // Criterios de alerta meteorológica
          const alertaViento = vientoVelocidad >= 35; // Vientos fuertes (> 35 km/h)
          const alertaTormenta = lluvia >= 5.0 || (lluvia > 0 && vientoVelocidad >= 30); // Lluvia fuerte o temporal

          let desc = 'Soleado / Parcialmente Nublado';
          if (alertaTormenta) desc = 'Tormenta / Temporal en zona';
          else if (lluvia > 0) desc = 'Lluvia en la ciudad';
          else if (alertaViento) desc = 'Vientos Fuertes';

          setClima({
            temp,
            sensacion,
            humedad,
            vientoVelocidad,
            lluvia,
            descripcion: desc,
            esLluvia: lluvia > 0,
            alertaViento,
            alertaTormenta,
          });
        }
      } catch (err) {
        console.warn('No se pudo cargar el clima:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClimaNogoya();
  }, []);

  if (loading || !clima) return null;

  const hayAlerta = clima.alertaTormenta || clima.alertaViento;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      {/* BADGE DEL CLIMA */}
      <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-xs font-semibold shadow-sm">
        {clima.alertaTormenta ? (
          <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
        ) : clima.esLluvia ? (
          <CloudRain className="w-4 h-4 text-blue-300 animate-bounce" />
        ) : (
          <CloudSun className="w-4 h-4 text-amber-300" />
        )}

        <span>
          Nogoyá: <strong className="text-sm font-black">{clima.temp}°C</strong>
        </span>
        <span className="hidden sm:inline text-white/80">• ST: {clima.sensacion}°C</span>
        <span className="hidden md:inline text-white/80">• Hum: {clima.humedad}%</span>
        {clima.vientoVelocidad > 0 && (
          <span className="hidden lg:inline text-white/80 flex items-center gap-1">
            • <Wind className="w-3 h-3 inline" /> {clima.vientoVelocidad} km/h
          </span>
        )}
      </div>

      {/* BANNER DE ALERTA AUTOMÁTICA EN CASO DE RIESGO */}
      {hayAlerta && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-gray-950 font-black text-[11px] rounded-xl shadow-md animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-950 shrink-0" />
          <span>
            {clima.alertaTormenta
              ? 'Alerta: Alerta de Tormenta en Nogoyá'
              : `Alerta: Vientos Fuertes (${clima.vientoVelocidad} km/h)`}
          </span>
        </div>
      )}
    </div>
  );
};
