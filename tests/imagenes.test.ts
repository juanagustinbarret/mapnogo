import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { detectarTipo, dimensiones, limpiarImagen, validarImagen } from '../supabase/functions/_shared/imagenes.ts';

// Imágenes inofensivas generadas con Pillow (tests/fixtures/imagenes)
const leer = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/imagenes/${n}`, import.meta.url)));
const contiene = (b: Uint8Array, texto: string) => Buffer.from(b).includes(Buffer.from(texto));

/** ¿La imagen limpia se sigue pudiendo abrir? (lo verifica Pillow, si está) */
function abreConPillow(b: Uint8Array): string | null {
  try {
    return execFileSync('python3', ['-c', 'import sys,io;from PIL import Image;i=Image.open(io.BytesIO(sys.stdin.buffer.read()));i.load();print(i.format,i.size[0],i.size[1])'], { input: Buffer.from(b) }).toString().trim();
  } catch (e) {
    return (e as { code?: string }).code === 'ENOENT' ? 'sin-python' : null;
  }
}

test('tipo real por la firma del archivo, no por la extensión', () => {
  assert.equal(detectarTipo(leer('foto_con_exif.jpg')), 'jpeg');
  assert.equal(detectarTipo(leer('foto_con_texto.png')), 'png');
  assert.equal(detectarTipo(leer('foto_con_exif.webp')), 'webp');
  assert.equal(detectarTipo(leer('animada.gif')), null);
  assert.equal(detectarTipo(leer('dibujo.svg')), null);
  assert.equal(detectarTipo(leer('falsa.jpg')), null, 'un ejecutable renombrado a .jpg no pasa');
});

test('ancho y alto leídos del archivo', () => {
  // simple.webp (VP8, como la genera el canvas del navegador) y sin_perdida.webp (VP8L)
  for (const n of ['foto_con_exif.jpg', 'foto_con_texto.png', 'foto_con_exif.webp', 'simple.webp', 'sin_perdida.webp']) {
    const b = leer(n);
    assert.deepEqual(dimensiones(b, detectarTipo(b)!), { ancho: 320, alto: 200 }, n);
  }
});

test('JPEG: se van EXIF (cámara, GPS) y comentarios; la foto se sigue viendo', () => {
  const original = leer('foto_con_exif.jpg');
  assert.ok(contiene(original, 'CamaraDePrueba') && contiene(original, 'comentario secreto'));
  const limpia = limpiarImagen(original, 'jpeg');
  assert.ok(!contiene(limpia, 'CamaraDePrueba') && !contiene(limpia, 'comentario secreto') && !contiene(limpia, 'Exif'));
  assert.ok(limpia.length < original.length);
  const pillow = abreConPillow(limpia);
  if (pillow !== 'sin-python') assert.equal(pillow, 'JPEG 320 200');
});

test('PNG: se van los textos y lo que estaba pegado después del final', () => {
  const original = leer('foto_con_texto.png');
  assert.ok(contiene(original, 'texto oculto') && contiene(original, '<?php'));
  const limpia = limpiarImagen(original, 'png');
  assert.ok(!contiene(limpia, 'texto oculto') && !contiene(limpia, 'Alguien') && !contiene(limpia, '<?php'));
  const pillow = abreConPillow(limpia);
  if (pillow !== 'sin-python') assert.equal(pillow, 'PNG 320 200');
});

test('WebP: se va el EXIF y se apaga la bandera en VP8X', () => {
  const original = leer('foto_con_exif.webp');
  assert.ok(contiene(original, 'CamaraDePrueba'));
  const limpia = limpiarImagen(original, 'webp');
  assert.ok(!contiene(limpia, 'CamaraDePrueba') && !contiene(limpia, 'EXIF'));
  assert.equal(limpia[20] & 0x08, 0, 'bandera EXIF apagada');
  assert.equal(new DataView(limpia.buffer, limpia.byteOffset).getUint32(4, true), limpia.length - 8, 'tamaño RIFF correcto');
  const pillow = abreConPillow(limpia);
  if (pillow !== 'sin-python') assert.equal(pillow, 'WEBP 320 200');
});

test('validación completa: aprobada, tipo falso, archivo enorme, medidas fuera de rango, dañada', () => {
  for (const n of ['simple.webp', 'sin_perdida.webp']) {
    const r = validarImagen(leer(n));
    assert.ok(r.ok, n);
    const pillow = abreConPillow(r.bytes);
    if (pillow !== 'sin-python') assert.equal(pillow, 'WEBP 320 200', n);
  }
  const ok = validarImagen(leer('foto_con_exif.jpg'));
  assert.ok(ok.ok && ok.tipo === 'jpeg' && ok.ancho === 320 && !contiene(ok.bytes, 'CamaraDePrueba'));
  assert.deepEqual(pick(validarImagen(leer('falsa.jpg'))), { ok: false, codigo: 'tipo_no_permitido' });
  assert.deepEqual(pick(validarImagen(leer('dibujo.svg'))), { ok: false, codigo: 'tipo_no_permitido' });
  assert.deepEqual(pick(validarImagen(leer('animada.gif'))), { ok: false, codigo: 'tipo_no_permitido' });
  const enorme = new Uint8Array(3_000_001);
  enorme.set(leer('foto_con_exif.jpg'));
  assert.deepEqual(pick(validarImagen(enorme)), { ok: false, codigo: 'muy_pesada' });
  assert.deepEqual(pick(validarImagen(leer('muy_ancha.png'))), { ok: false, codigo: 'muy_grande' });
  assert.deepEqual(pick(validarImagen(leer('muy_chica.jpg'))), { ok: false, codigo: 'muy_chica' });
  const cortada = leer('foto_con_exif.jpg').slice(0, 900);
  assert.deepEqual(pick(validarImagen(cortada)), { ok: false, codigo: 'dañada' });
  assert.deepEqual(pick(validarImagen(new Uint8Array())), { ok: false, codigo: 'vacia' });
});

const pick = (r: ReturnType<typeof validarImagen>) => (r.ok ? { ok: true } : { ok: false, codigo: r.codigo });
