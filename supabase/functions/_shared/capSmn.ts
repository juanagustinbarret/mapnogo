// supabase/functions/_shared/capSmn.ts
//
// Alertas del SMN en formato CAP: lectura del feed y de cada XML, y filtro
// por zona y vigencia. Lo usan la Edge Function alertas-smn (el cron que baja
// los XML) y /api/alertas (src/lib/alertasSmn.ts). Sin dependencias.
//
// Fuente: https://ssl.smn.gob.ar/CAP/AR.php (listado en el registro de
// alertas de la OMM). Es un RSS con un enlace por área a un XML CAP 1.2;
// cada XML trae fenómeno, severidad, vigencia, texto y un polígono (areaDesc
// viene vacío), así que se filtra por coordenadas.

export const URL_CAP_SMN = 'https://ssl.smn.gob.ar/CAP/AR.php';
// Las mismas coordenadas que COORDENADAS_NOGOYA (src/lib/clima.ts)
export const PUNTO_NOGOYA = { lat: -32.3942, lon: -59.7881 };
// Los XML de estas regiones (por el nombre del archivo) no pueden incluir a Entre Ríos
export const REGIONES_AJENAS = /_(Cordillera|Patagonia)_/;
export const HORAS_PROXIMAS_ALERTAS = 12;

export type NivelAlerta = 'amarilla' | 'naranja' | 'roja';

export interface AlertaSmn {
  fenomeno: string;
  nivel: NivelAlerta;
  inicio: string; // ISO
  fin: string; // ISO
  descripcion: string;
  rafagas?: number; // km/h, solo si el texto del SMN las menciona ("ráfagas … de hasta 90 km/h")
}

export interface AlertaCap extends AlertaSmn {
  zona: string;
  poligonos: [number, number][][]; // [lat, lon]
}

const NIVEL_POR_SEVERIDAD: Record<string, NivelAlerta> = { Moderate: 'amarilla', Severe: 'naranja', Extreme: 'roja' };
const ORDEN_NIVEL: Record<NivelAlerta, number> = { roja: 3, naranja: 2, amarilla: 1 };

/**
 * Enlaces a los XML CAP del feed del SMN. Al servidor le llega como RSS; a un
 * navegador, como página HTML. null si no tiene ninguno de los dos formatos.
 */
export function enlacesCap(html: string): string[] | null {
  if (!/<rss[\s>]|RSS CAP SMN/i.test(html)) return null;
  const enlaces = html.match(/https:\/\/ssl\.smn\.gob\.ar\/feeds\/CAP\/xml_generados\/[\w.-]+\.xml/g) ?? [];
  return [...new Set(enlaces)];
}

const decodificar = (texto: string) =>
  texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

const etiqueta = (xml: string, nombre: string) => {
  const m = xml.match(new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`));
  return m ? decodificar(m[1]) : '';
};

/** Interpreta un XML CAP del SMN. null si falta algo esencial o la severidad no es amarilla/naranja/roja. */
export function interpretarCap(xml: string): AlertaCap | null {
  if (!/<alert[\s>]/.test(xml)) return null;
  const nivel = NIVEL_POR_SEVERIDAD[etiqueta(xml, 'severity')];
  const fenomeno = etiqueta(xml, 'event') || etiqueta(xml, 'headline');
  const inicio = Date.parse(etiqueta(xml, 'onset') || etiqueta(xml, 'effective'));
  const fin = Date.parse(etiqueta(xml, 'expires'));
  if (!nivel || !fenomeno || Number.isNaN(inicio) || Number.isNaN(fin)) return null;
  const poligonos = [...xml.matchAll(/<polygon>([\s\S]*?)<\/polygon>/g)]
    .map((m) => m[1].trim().split(/\s+/).map((par) => par.split(',').map(Number) as [number, number]))
    .filter((puntos) => puntos.length >= 3 && puntos.every(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon)));
  const descripcion = etiqueta(xml, 'description');
  const rafagas = Number(descripcion.match(/r[áa]fagas[^.]*?(\d{2,3})\s*km\/h/i)?.[1]);
  return {
    fenomeno,
    nivel,
    inicio: new Date(inicio).toISOString(),
    fin: new Date(fin).toISOString(),
    descripcion,
    ...(rafagas ? { rafagas } : {}),
    zona: etiqueta(xml, 'areaDesc'),
    poligonos,
  };
}

/** Punto dentro de un polígono (ray casting). */
function contiene(poligono: [number, number][], lat: number, lon: number): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** La alerta toca el punto: su área lo contiene (o nombra a Nogoyá). */
export function afecta(alerta: AlertaCap, punto = PUNTO_NOGOYA): boolean {
  return /nogoy[aá]/i.test(alerta.zona) || alerta.poligonos.some((p) => contiene(p, punto.lat, punto.lon));
}

/** La alerta sin la zona ni los polígonos (lo que se guarda y se muestra). */
export function sinArea({ zona: _zona, poligonos: _poligonos, ...alerta }: AlertaCap): AlertaSmn {
  return alerta;
}

/** Las vigentes o que empiezan en las próximas horas, sin repetidas, la más grave primero. */
export function vigentes(alertas: AlertaSmn[], ahora: Date = new Date()): AlertaSmn[] {
  const limite = ahora.getTime() + HORAS_PROXIMAS_ALERTAS * 3600_000;
  const vistas = new Set<string>();
  return alertas
    .filter((a) => Date.parse(a.fin) > ahora.getTime() && Date.parse(a.inicio) <= limite)
    .filter((a) => {
      const clave = `${a.fenomeno}|${a.nivel}|${a.inicio}|${a.fin}`;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    })
    .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel] || Date.parse(a.inicio) - Date.parse(b.inicio));
}

/** Las alertas de Nogoyá vigentes o próximas, la más grave primero. */
export function filtrarAlertas(alertas: AlertaCap[], punto = PUNTO_NOGOYA, ahora: Date = new Date()): AlertaSmn[] {
  return vigentes(alertas.filter((a) => afecta(a, punto)).map(sinArea), ahora);
}
