// supabase/functions/_shared/imagenes.ts
//
// Validación de imágenes subidas, sin dependencias (Deno y Node):
//  - el tipo REAL por la firma del archivo (magic bytes), no por la extensión
//    ni por lo que diga el navegador: solo JPEG, PNG y WebP;
//  - ancho y alto leídos del propio archivo (mínimo y máximo);
//  - limpieza: se rearma el archivo dejando solo lo necesario para dibujar la
//    imagen. Se van EXIF (con GPS), XMP, comentarios, textos de PNG, perfiles
//    y cualquier cosa pegada después del final de la imagen.
//
// Nota honesta: esto NO es recodificar píxel por píxel en el servidor (para
// eso hace falta una librería de imágenes). La recodificación completa la hace
// el navegador antes de subir (canvas → WebP, ver GaleriaModerada.tsx), y el
// servidor igual limpia y verifica por si alguien se saltea la app.

export type TipoImagen = 'jpeg' | 'png' | 'webp';

export const MIME: Record<TipoImagen, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const EXTENSION: Record<TipoImagen, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

const ascii = (b: Uint8Array, desde: number, largo: number) => String.fromCharCode(...b.subarray(desde, desde + largo));

export function detectarTipo(b: Uint8Array): TipoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + ((b[i + 3] << 24) >>> 0);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

export function dimensiones(b: Uint8Array, tipo: TipoImagen): { ancho: number; alto: number } | null {
  try {
    if (tipo === 'png') {
      if (ascii(b, 12, 4) !== 'IHDR') return null;
      return { ancho: u32be(b, 16), alto: u32be(b, 20) };
    }
    if (tipo === 'webp') {
      const fourcc = ascii(b, 12, 4);
      if (fourcc === 'VP8X') return { ancho: u24le(b, 24) + 1, alto: u24le(b, 27) + 1 };
      if (fourcc === 'VP8 ') return { ancho: u16le(b, 26) & 0x3fff, alto: u16le(b, 28) & 0x3fff };
      if (fourcc === 'VP8L') {
        const bits = u32le(b, 21);
        return { ancho: (bits & 0x3fff) + 1, alto: ((bits >>> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    // JPEG: buscar el marcador SOF
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
        i += 2;
        continue;
      }
      const largo = u16be(b, i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { alto: u16be(b, i + 5), ancho: u16be(b, i + 7) };
      i += 2 + largo;
    }
    return null;
  } catch {
    return null;
  }
}
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);

const unir = (partes: Uint8Array[]) => {
  const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};

// PNG: solo lo que hace falta para dibujar
const PNG_CONSERVAR = new Set(['IHDR', 'PLTE', 'tRNS', 'gAMA', 'sRGB', 'IDAT', 'IEND']);

function limpiarPng(b: Uint8Array): Uint8Array {
  const partes = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const largo = u32be(b, i);
    const tipo = ascii(b, i + 4, 4);
    const fin = i + 12 + largo;
    if (fin > b.length) throw new Error('PNG cortado');
    if (PNG_CONSERVAR.has(tipo)) partes.push(b.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') return unir(partes); // lo que venga después se descarta
  }
  throw new Error('PNG sin IEND');
}

// JPEG: se descartan APP1–APP13 y APP15 (EXIF, XMP, ICC, Photoshop…) y los
// comentarios. Se conserva APP0 (JFIF) y APP14 (Adobe: lo necesitan algunos
// JPEG para mostrar bien los colores).
function limpiarJpeg(b: Uint8Array): Uint8Array {
  const partes = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('JPEG inválido');
    const m = b[i + 1];
    if (m === 0xff) {
      i++;
      continue;
    }
    if (m === 0xd9) {
      partes.push(b.subarray(i, i + 2));
      return unir(partes);
    }
    const largo = u16be(b, i + 2);
    const fin = i + 2 + largo;
    if (fin > b.length) throw new Error('JPEG cortado');
    const descartar = (m >= 0xe1 && m <= 0xed) || m === 0xef || m === 0xfe;
    if (m === 0xda) {
      // Comienzo de los datos de la imagen: copiar hasta EOI (FFD9 fuera de un byte de relleno)
      let j = fin;
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] === 0xd9)) j++;
      if (j + 1 >= b.length) throw new Error('JPEG sin final');
      partes.push(b.subarray(i, j + 2));
      return unir(partes); // lo que venga después de EOI se descarta
    }
    if (!descartar) partes.push(b.subarray(i, fin));
    i = fin;
  }
  throw new Error('JPEG sin datos de imagen');
}

// WebP: se descartan EXIF, XMP e ICCP; en VP8X se apagan esas banderas
const WEBP_CONSERVAR = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF']);

function limpiarWebp(b: Uint8Array): Uint8Array {
  const tamRiff = u32le(b, 4);
  const finRiff = Math.min(b.length, 8 + tamRiff);
  const partes: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= finRiff) {
    const tipo = ascii(b, i, 4);
    const largo = u32le(b, i + 4);
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > finRiff) throw new Error('WebP cortado');
    if (WEBP_CONSERVAR.has(tipo)) {
      const trozo = b.slice(i, Math.min(fin, finRiff));
      if (tipo === 'VP8X') trozo[8] &= ~(0x20 | 0x08 | 0x04); // ICC, EXIF, XMP
      partes.push(trozo);
    }
    i = fin;
  }
  const cuerpo = unir(partes);
  const cabecera = new Uint8Array(12);
  cabecera.set(b.subarray(0, 4), 0);
  new DataView(cabecera.buffer).setUint32(4, cuerpo.length + 4, true);
  cabecera.set(b.subarray(8, 12), 8);
  return unir([cabecera, cuerpo]);
}

export function limpiarImagen(b: Uint8Array, tipo: TipoImagen): Uint8Array {
  if (tipo === 'png') return limpiarPng(b);
  if (tipo === 'jpeg') return limpiarJpeg(b);
  return limpiarWebp(b);
}

export interface ReglasImagen {
  maxBytes: number;
  maxLado: number;
  minLado: number;
}

export const REGLAS_POR_DEFECTO: ReglasImagen = { maxBytes: 3_000_000, maxLado: 4096, minLado: 100 };

export type ResultadoValidacion =
  | { ok: true; tipo: TipoImagen; ancho: number; alto: number; bytes: Uint8Array }
  | { ok: false; codigo: 'vacia' | 'muy_pesada' | 'tipo_no_permitido' | 'dañada' | 'muy_grande' | 'muy_chica'; mensaje: string };

/** Valida y limpia. El mensaje es para mostrarle al dueño del comercio. */
export function validarImagen(b: Uint8Array, reglas: ReglasImagen = REGLAS_POR_DEFECTO): ResultadoValidacion {
  if (!b.length) return { ok: false, codigo: 'vacia', mensaje: 'El archivo está vacío.' };
  if (b.length > reglas.maxBytes) return { ok: false, codigo: 'muy_pesada', mensaje: `La imagen pesa más de ${Math.round(reglas.maxBytes / 1_000_000)} MB.` };
  const tipo = detectarTipo(b);
  if (!tipo) return { ok: false, codigo: 'tipo_no_permitido', mensaje: 'Solo se aceptan fotos JPG, PNG o WebP.' };
  let limpia: Uint8Array;
  try {
    limpia = limpiarImagen(b, tipo);
  } catch {
    return { ok: false, codigo: 'dañada', mensaje: 'La imagen está dañada o incompleta.' };
  }
  const dim = dimensiones(limpia, tipo);
  if (!dim || !dim.ancho || !dim.alto) return { ok: false, codigo: 'dañada', mensaje: 'No se pudo leer el tamaño de la imagen.' };
  if (dim.ancho > reglas.maxLado || dim.alto > reglas.maxLado) return { ok: false, codigo: 'muy_grande', mensaje: `La imagen mide más de ${reglas.maxLado} px de lado.` };
  if (dim.ancho < reglas.minLado || dim.alto < reglas.minLado) return { ok: false, codigo: 'muy_chica', mensaje: `La imagen es muy chica (mínimo ${reglas.minLado} px de lado).` };
  return { ok: true, tipo, ancho: dim.ancho, alto: dim.alto, bytes: limpia };
}
