import { CIUDAD, PROVINCIA } from '../config/marca';
import { NOGOYA_CENTER } from './distance';

// Rectángulo que contiene a Nogoyá (oeste, norte, este, sur)
const VIEWBOX = '-59.8200,-32.3700,-59.7500,-32.4200';

/**
 * Convierte una dirección de Nogoyá en coordenadas usando Nominatim
 * (OpenStreetMap). Se llama UNA vez al guardar la dirección, nunca al
 * mostrar el mapa: Nominatim admite como máximo 1 consulta por segundo.
 */
export const geocodificarDireccion = async (
  direccion: string,
): Promise<{ lat: number; lng: number } | null> => {
  const limpia = direccion.trim();
  if (!limpia) return null;

  const query = encodeURIComponent(`${limpia}, ${CIUDAD}, ${PROVINCIA}, Argentina`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&viewbox=${VIEWBOX}&bounded=1&limit=1`,
      { headers: { 'Accept-Language': 'es' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
};

/**
 * Un comercio sin ubicar tiene las coordenadas del centro por defecto
 * (las que dejaba el alta antes de esta corrección).
 */
export const tieneCoordenadasPorDefecto = (lat: number, lng: number): boolean =>
  Math.abs(Number(lat) - NOGOYA_CENTER.lat) < 1e-6 && Math.abs(Number(lng) - NOGOYA_CENTER.lng) < 1e-6;

export const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
