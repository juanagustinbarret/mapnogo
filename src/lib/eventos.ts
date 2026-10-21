// src/lib/eventos.ts
//
// Textos de fecha y hora de los eventos. Antes la marquesina y el panel
// mostraban los valores crudos de la base ("2026-10-25", "21:00:00 a ??").

import { formatearFecha } from './fechasArgentina';

/** "21:00:00" → "21:00"; vacío si no hay hora válida. */
export function horaCorta(hora?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** "21:00 a 23:30 hs", "21:00 hs" o "" si no hay hora de inicio. */
export function textoHorarioEvento(inicio?: string | null, fin?: string | null): string {
  const desde = horaCorta(inicio);
  const hasta = horaCorta(fin);
  if (!desde) return '';
  return hasta ? `${desde} a ${hasta} hs` : `${desde} hs`;
}

/** Fecha del evento en formato argentino (dd/mm/aaaa); la cruda si no se entiende. */
export function textoFechaEvento(fecha?: string | null): string {
  return formatearFecha(fecha) || (fecha ?? '');
}

// ─── Ficha del evento (tocar un evento en la marquesina) ────────────────

export interface EventoPublico {
  id: string;
  titulo: string;
  descripcion?: string | null;
  fecha_evento: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  ubicacion_texto?: string | null;
  imagen_url?: string | null;
  // Punto marcado en el mapa al cargar el evento (columnas nuevas: pueden no venir)
  latitud?: number | string | null;
  longitud?: number | string | null;
}

export interface PuntoMapa {
  lat: number;
  lng: number;
}

const LOCALIDAD = 'Nogoyá, Entre Ríos';

// Rectángulo que contiene a la Argentina continental. Sirve para descartar
// coordenadas vacías (0, 0) o con latitud y longitud invertidas.
const DENTRO_DE_ARGENTINA = { latMin: -56, latMax: -21, lngMin: -74, lngMax: -53 };

/** Punto del evento si tiene coordenadas válidas; null si no. */
export function puntoDelEvento(evento: Pick<EventoPublico, 'latitud' | 'longitud'>): PuntoMapa | null {
  if (evento.latitud == null || evento.longitud == null || evento.latitud === '' || evento.longitud === '') return null;
  const lat = Number(evento.latitud);
  const lng = Number(evento.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { latMin, latMax, lngMin, lngMax } = DENTRO_DE_ARGENTINA;
  if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) return null;
  return { lat, lng };
}

/**
 * Link de Google Maps con el recorrido hasta el evento (null si no hay
 * lugar). Si el evento tiene un punto marcado en el mapa, se usa ese punto:
 * buscar por el nombre del lugar ("Parque Municipal") muchas veces lleva a
 * otro lado.
 */
export function linkComoLlegarEvento(ubicacion?: string | null, punto?: PuntoMapa | null): string | null {
  if (punto) {
    return `https://www.google.com/maps/dir/?api=1&destination=${punto.lat.toFixed(6)},${punto.lng.toFixed(6)}`;
  }
  const lugar = (ubicacion ?? '').trim();
  if (!lugar) return null;
  const destino = /nogoy[aá]/i.test(lugar) ? lugar : `${lugar}, ${LOCALIDAD}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/** Link para compartir: abre el inicio con la ficha del evento. */
export function linkEvento(origen: string, id: string): string {
  return `${origen.replace(/\/+$/, '')}/?evento=${encodeURIComponent(id)}`;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const aUtcIcs = (d: Date) =>
  `${d.getUTCFullYear()}${dosDigitos(d.getUTCMonth() + 1)}${dosDigitos(d.getUTCDate())}T${dosDigitos(d.getUTCHours())}${dosDigitos(d.getUTCMinutes())}00Z`;
const escaparIcs = (texto: string) => texto.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/**
 * Archivo de calendario (.ics) para "Agendar". Las horas son de Argentina
 * (UTC-3) y se guardan en UTC. Sin hora de inicio, es un evento de todo el
 * día; sin hora de fin, dura 2 horas; si la de fin es menor, termina al día
 * siguiente (ej. 22:00 a 02:00).
 */
export function archivoCalendario(evento: EventoPublico, ahora: Date = new Date()): string {
  const fecha = evento.fecha_evento.slice(0, 10);
  const inicioTxt = horaCorta(evento.hora_inicio);
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOGOYORK//Eventos//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT'];
  lineas.push(`UID:evento-${evento.id}@nogoyork`, `DTSTAMP:${aUtcIcs(ahora)}`);
  if (inicioTxt) {
    const inicio = new Date(`${fecha}T${inicioTxt}:00-03:00`);
    const finTxt = horaCorta(evento.hora_fin);
    let fin = finTxt ? new Date(`${fecha}T${finTxt}:00-03:00`) : new Date(inicio.getTime() + 2 * 3600_000);
    if (fin <= inicio) fin = new Date(fin.getTime() + 24 * 3600_000);
    lineas.push(`DTSTART:${aUtcIcs(inicio)}`, `DTEND:${aUtcIcs(fin)}`);
  } else {
    const siguiente = new Date(`${fecha}T12:00:00Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    lineas.push(`DTSTART;VALUE=DATE:${fecha.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${siguiente.toISOString().slice(0, 10).replace(/-/g, '')}`);
  }
  lineas.push(`SUMMARY:${escaparIcs(evento.titulo)}`);
  if (evento.descripcion) lineas.push(`DESCRIPTION:${escaparIcs(evento.descripcion)}`);
  if (evento.ubicacion_texto) lineas.push(`LOCATION:${escaparIcs(`${evento.ubicacion_texto}, ${LOCALIDAD}`)}`);
  const punto = puntoDelEvento(evento);
  if (punto) lineas.push(`GEO:${punto.lat.toFixed(6)};${punto.lng.toFixed(6)}`);
  lineas.push('END:VEVENT', 'END:VCALENDAR');
  return lineas.join('\r\n') + '\r\n';
}
