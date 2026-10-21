// src/lib/geocodificacion.ts
//
// Consultas a Nominatim (OpenStreetMap) para ubicar direcciones en el mapa y
// para saber en qué calle está el usuario.
//
// Nominatim pide no hacer más de 1 consulta por segundo y guardar los
// resultados (https://operations.osmfoundation.org/policies/nominatim/).
// Antes el mapa volvía a consultar todas las direcciones cada vez que la
// página se redibujaba; con la ubicación en vivo eso pasaría cada pocos
// segundos. Por eso acá:
//   - las consultas van en fila, de a una y con 1,1 s de separación;
//   - cada dirección se consulta una sola vez por visita;
//   - las que se encuentran quedan guardadas 30 días en el navegador.
//
// Lo ideal sigue siendo guardar latitud y longitud de cada comercio en la base
// de datos: los comercios que ya las tienen no usan este archivo.

export interface Coordenadas {
  lat: number;
  lng: number;
}

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org';
// Rectángulo que encierra Nogoyá: oeste, norte, este, sur.
const VIEWBOX_NOGOYA = '-59.8200,-32.3700,-59.7500,-32.4200';
const SEPARACION_MS = 1100;
const CLAVE_ALMACEN = 'nogoyork:geocodificacion:v1';
const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000;

type Guardadas = Record<string, Coordenadas & { t: number }>;

// null = se consultó y no se encontró (no se vuelve a intentar en esta visita)
const enMemoria = new Map<string, Coordenadas | null>();
const enCurso = new Map<string, Promise<Coordenadas | null>>();
let guardadas: Guardadas = leerGuardadas();

function leerGuardadas(): Guardadas {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACEN);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as Guardadas;
    const ahora = Date.now();
    const vigentes: Guardadas = {};
    for (const [direccion, punto] of Object.entries(datos)) {
      if (
        punto &&
        Number.isFinite(punto.lat) &&
        Number.isFinite(punto.lng) &&
        Number.isFinite(punto.t) &&
        ahora - punto.t < VIGENCIA_MS
      ) {
        vigentes[direccion] = punto;
      }
    }
    return vigentes;
  } catch {
    return {};
  }
}

function escribirGuardadas() {
  try {
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(guardadas));
  } catch {
    // Navegación privada o almacenamiento lleno: se sigue sin guardar.
  }
}

const normalizar = (direccion: string) => direccion.trim().replace(/\s+/g, ' ').toLowerCase();

// ─── Fila de consultas (máximo 1 por segundo) ─────────────────────────────
let fila: Promise<unknown> = Promise.resolve();
let ultimaConsulta = 0;

function enFila<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = fila.then(async () => {
    const espera = ultimaConsulta + SEPARACION_MS - Date.now();
    if (espera > 0) await new Promise((listo) => setTimeout(listo, espera));
    ultimaConsulta = Date.now();
    return tarea();
  });
  fila = resultado.catch(() => undefined);
  return resultado;
}

async function pedirJson<T>(url: string): Promise<T> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

/**
 * Coordenadas ya conocidas para una dirección, sin consultar a nadie.
 * Devuelve `undefined` si todavía no se buscó y `null` si se buscó y no se encontró.
 */
export function coordenadasGuardadas(direccion: string): Coordenadas | null | undefined {
  const clave = normalizar(direccion);
  if (enMemoria.has(clave)) return enMemoria.get(clave) ?? null;
  const punto = guardadas[clave];
  if (punto) {
    const coordenadas = { lat: punto.lat, lng: punto.lng };
    enMemoria.set(clave, coordenadas);
    return coordenadas;
  }
  return undefined;
}

/** Busca una dirección de Nogoyá. Nunca rechaza: si falla, devuelve null. */
export function geocodificarDireccion(direccion: string): Promise<Coordenadas | null> {
  const clave = normalizar(direccion);
  if (!clave) return Promise.resolve(null);

  const conocida = coordenadasGuardadas(direccion);
  if (conocida !== undefined) return Promise.resolve(conocida);

  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente;

  const consulta = enFila(async () => {
    // Igual que antes: "San Martín 123" → "Calle San Martín 123", que Nominatim
    // encuentra mejor dentro de Nogoyá.
    let texto = direccion.trim();
    if (!texto.toLowerCase().includes('calle')) texto = `Calle ${texto}`;
    const q = encodeURIComponent(`${texto}, Nogoyá, Entre Ríos, Argentina`);
    const datos = await pedirJson<Array<{ lat: string; lon: string }>>(
      `${URL_NOMINATIM}/search?format=json&q=${q}&viewbox=${VIEWBOX_NOGOYA}&bounded=1&limit=1&accept-language=es`,
    );
    const primero = datos?.[0];
    if (!primero) return null;
    const coordenadas = { lat: parseFloat(primero.lat), lng: parseFloat(primero.lon) };
    return Number.isFinite(coordenadas.lat) && Number.isFinite(coordenadas.lng) ? coordenadas : null;
  })
    .then((coordenadas) => {
      enMemoria.set(clave, coordenadas);
      if (coordenadas) {
        guardadas = { ...guardadas, [clave]: { ...coordenadas, t: Date.now() } };
        escribirGuardadas();
      }
      return coordenadas;
    })
    .catch((error) => {
      console.error('Error al geocodificar dirección:', error);
      enMemoria.set(clave, null);
      return null;
    })
    .finally(() => enCurso.delete(clave));

  enCurso.set(clave, consulta);
  return consulta;
}

/** Nombre de la calle en esas coordenadas (o null si no se pudo averiguar). */
export function calleEnCoordenadas(lat: number, lng: number): Promise<string | null> {
  return enFila(async () => {
    const datos = await pedirJson<{ address?: { road?: string; pedestrian?: string } }>(
      `${URL_NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=es`,
    );
    return datos.address?.road || datos.address?.pedestrian || null;
  });
}

/**
 * Busca un lugar por nombre ("Plaza Libertad", "Club Sarmiento", "Parque
 * Municipal") para ubicar el mapa al cargar un evento. A diferencia de
 * geocodificarDireccion no le agrega "Calle" adelante y no se limita al
 * rectángulo del centro: prefiere Nogoyá pero acepta la zona (un evento puede
 * ser en un club o una aldea de las afueras). Respeta la misma fila de 1
 * consulta por segundo. Es solo una ayuda: el punto final lo marca el admin.
 */
export function buscarLugar(texto: string): Promise<Coordenadas | null> {
  const limpio = texto.trim();
  if (!limpio) return Promise.resolve(null);
  return enFila(async () => {
    const q = encodeURIComponent(/nogoy[aá]/i.test(limpio) ? `${limpio}, Entre Ríos, Argentina` : `${limpio}, Nogoyá, Entre Ríos, Argentina`);
    const datos = await pedirJson<Array<{ lat: string; lon: string }>>(
      `${URL_NOMINATIM}/search?format=json&q=${q}&viewbox=${VIEWBOX_NOGOYA}&bounded=0&countrycodes=ar&limit=1&accept-language=es`,
    );
    const primero = datos?.[0];
    if (!primero) return null;
    const punto = { lat: parseFloat(primero.lat), lng: parseFloat(primero.lon) };
    return Number.isFinite(punto.lat) && Number.isFinite(punto.lng) ? punto : null;
  }).catch((error) => {
    console.error('Error al buscar el lugar:', error);
    return null;
  });
}
