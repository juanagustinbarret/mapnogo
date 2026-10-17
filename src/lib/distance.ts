// src/lib/distance.ts

export const NOGOYA_CENTER = {
  lat: -32.3939,
  lng: -59.7881,
  zoom: 14,
};

// Cálculo de distancia mediante fórmula de Haversine en metros
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Devuelve metros exactos
};

// Cálculo directo en kilómetros (útil para filtros de radio en la app)
export const calcularDistanciaKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const metros = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  return Math.round((metros / 1000) * 100) / 100; // Kilómetros con 2 decimales
};

// Formateador amigable para UI (ej: "350 m" o "1.4 km")
export const formatearDistancia = (distanciaKm: number | null): string => {
  if (distanciaKm === null || distanciaKm === undefined) return '';
  if (distanciaKm < 1) {
    return `${Math.round(distanciaKm * 1000)} m`;
  }
  return `${distanciaKm.toFixed(1)} km`;
};
