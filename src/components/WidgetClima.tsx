import React, { useEffect, useState } from 'react';
import { CloudSun, Thermometer, CloudRain, AlertTriangle } from 'lucide-react';

interface ClimaData {
  temp: number;
  sensacion: number;
  humedad: number;
  descripcion: string;
  esLluvia: boolean;
}

export const WidgetClima: React.FC = () => {
  const [clima, setClima] = useState<ClimaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClimaNogoya = async () => {
      try {
        // Coordenadas aproximadas de Nogoyá, Entre Ríos (-32.3942, -59.7881)
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-32.3942&longitude=-59.7881&current=temperature_2m,relative_humidity_2m,apparent_temperature,rain&timezone=America%2FArgentina%2FBuenos_Aires'
        );
        const data = await res.json();

        if (data?.current) {
          setClima({
            temp: Math.round(data.current.temperature_2m),
            sensacion: Math.round(data.current.apparent_temperature),
            humedad: data.current.relative_humidity_2m,
            descripcion: data.current.rain > 0 ? 'Lluvia en la ciudad' : 'Soleado / Nublado',
            esLluvia: data.current.rain > 0,
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

  return (
    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-xs font-semibold shadow-sm">
      {clima.esLluvia ? (
        <CloudRain className="w-4 h-4 text-blue-300 animate-bounce" />
      ) : (
        <CloudSun className="w-4 h-4 text-amber-300" />
      )}

      <span>Nogoyá: <strong className="text-sm font-black">{clima.temp}°C</strong></span>
      <span className="hidden sm:inline text-white/80">• ST: {clima.sensacion}°C</span>
      <span className="hidden md:inline text-white/80">• Hum: {clima.humedad}%</span>
    </div>
  );
};
