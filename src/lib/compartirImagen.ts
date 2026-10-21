// src/lib/compartirImagen.ts
//
// Compartir o guardar las imágenes del panel (QR, cartel, story).
//
// En iPhone, sobre todo con NOGOYORK agregada a la pantalla de inicio, un
// <a download> con una imagen generada no hace nada o abre una vista sin
// salida. Antes "andaba" porque el QR era una imagen de api.qrserver.com y el
// link abría esa página. Ahora, en celulares, se abre la hoja de compartir del
// sistema (Web Share API con archivos: iOS 15+, Android Chrome), desde donde
// se puede "Guardar imagen", mandarla por WhatsApp o subirla a Instagram. En
// computadoras, o si el navegador no puede compartir archivos, se descarga.
//
// Importante: navigator.share() tiene que llamarse dentro del toque del
// usuario. Por eso el archivo se arma de forma sincrónica (canvas.toDataURL)
// y compartirOGuardar llama a share() antes de cualquier await.

export type ResultadoCompartir = 'compartido' | 'cancelado' | 'descargado';

interface Entorno {
  nav?: Pick<Navigator, 'share' | 'canShare'> | null;
  tactil?: boolean;
  descargar?: (archivo: File) => void;
}

/** "data:image/png;base64,…" → File, sin esperas (para no perder el toque). */
export function archivoDesdeDataUrl(dataUrl: string, nombre: string): File {
  const coma = dataUrl.indexOf(',');
  const cabecera = dataUrl.slice(0, coma);
  const datos = dataUrl.slice(coma + 1);
  const tipo = /^data:([^;,]+)/.exec(cabecera)?.[1] ?? 'application/octet-stream';
  let bytes: Uint8Array;
  if (cabecera.includes(';base64')) {
    const bin = atob(datos);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(datos));
  }
  return new File([bytes as BlobPart], nombre, { type: tipo });
}

export const archivoDesdeCanvas = (canvas: HTMLCanvasElement, nombre: string) =>
  archivoDesdeDataUrl(canvas.toDataURL('image/png'), nombre);

const navegador = (): Entorno['nav'] => (typeof navigator === 'undefined' ? null : navigator);

/** Pantalla táctil (celular o tablet): ahí conviene la hoja de compartir. */
export function esTactil(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** ¿Este navegador puede compartir este archivo con la hoja del sistema? */
export function puedeCompartirArchivo(archivo: File, nav: Entorno['nav'] = navegador()): boolean {
  try {
    return !!nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [archivo] });
  } catch {
    return false;
  }
}

/** ¿Se va a ofrecer "compartir" (y no "descargar") en este dispositivo? */
export function ofreceCompartir(entorno: Entorno = {}): boolean {
  const tactil = entorno.tactil ?? esTactil();
  if (!tactil || typeof File === 'undefined') return false;
  return puedeCompartirArchivo(new File([new Uint8Array(1)], 'x.png', { type: 'image/png' }), entorno.nav ?? navegador());
}

export function descargarArchivo(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari necesita la URL viva un rato después del click
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * En celulares abre la hoja de compartir; si no se puede (o falla por algo
 * que no sea que la persona la cerró), descarga el archivo.
 */
export async function compartirOGuardar(archivo: File, titulo: string, entorno: Entorno = {}): Promise<ResultadoCompartir> {
  const nav = entorno.nav === undefined ? navegador() : entorno.nav;
  const tactil = entorno.tactil ?? esTactil();
  const descargar = entorno.descargar ?? descargarArchivo;
  if (tactil && nav && puedeCompartirArchivo(archivo, nav)) {
    try {
      await nav.share!({ files: [archivo], title: titulo });
      return 'compartido';
    } catch (e) {
      // La persona cerró la hoja: no descargar nada por su cuenta
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelado';
      // NotAllowedError u otro: seguimos con la descarga
    }
  }
  descargar(archivo);
  return 'descargado';
}
