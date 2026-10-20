import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archivoDesdeDataUrl, compartirOGuardar, ofreceCompartir, puedeCompartirArchivo } from '../src/lib/compartirImagen.ts';

const png = () => archivoDesdeDataUrl('data:image/png;base64,iVBORw0KGgo=', 'QR.png');

function navFalso(opciones: { puede?: boolean; error?: string } = {}) {
  const llamadas: unknown[] = [];
  return {
    llamadas,
    canShare: () => opciones.puede ?? true,
    share: (datos: unknown) => {
      llamadas.push(datos);
      if (opciones.error) {
        const e = new Error(opciones.error);
        e.name = opciones.error;
        return Promise.reject(e);
      }
      return Promise.resolve();
    },
  };
}

test('archivo desde data URL: PNG en base64 y SVG en texto', async () => {
  const a = png();
  assert.equal(a.name, 'QR.png');
  assert.equal(a.type, 'image/png');
  assert.deepEqual([...new Uint8Array(await a.arrayBuffer())], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const s = archivoDesdeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg>ñ</svg>')}`, 'QR.svg');
  assert.equal(s.type, 'image/svg+xml');
  assert.equal(await s.text(), '<svg>ñ</svg>');
});

test('en el celular abre la hoja de compartir, llamada dentro del toque (sin esperas antes)', async () => {
  const nav = navFalso();
  const bajadas: File[] = [];
  const promesa = compartirOGuardar(png(), 'QR de reseñas', { nav, tactil: true, descargar: (f) => bajadas.push(f) });
  // iPhone exige que share() se llame antes de cualquier await
  assert.equal(nav.llamadas.length, 1);
  assert.equal(await promesa, 'compartido');
  assert.equal((nav.llamadas[0] as { files: File[] }).files[0].name, 'QR.png');
  assert.equal(bajadas.length, 0);
});

test('si la persona cierra la hoja no se descarga nada; si share falla, se descarga', async () => {
  const bajadas: File[] = [];
  const descargar = (f: File) => bajadas.push(f);
  assert.equal(await compartirOGuardar(png(), 't', { nav: navFalso({ error: 'AbortError' }), tactil: true, descargar }), 'cancelado');
  assert.equal(bajadas.length, 0);
  assert.equal(await compartirOGuardar(png(), 't', { nav: navFalso({ error: 'NotAllowedError' }), tactil: true, descargar }), 'descargado');
  assert.equal(bajadas.length, 1);
});

test('en computadora, o si no puede compartir archivos, descarga', async () => {
  const bajadas: File[] = [];
  const descargar = (f: File) => bajadas.push(f);
  const nav = navFalso();
  assert.equal(await compartirOGuardar(png(), 't', { nav, tactil: false, descargar }), 'descargado');
  assert.equal(nav.llamadas.length, 0);
  assert.equal(await compartirOGuardar(png(), 't', { nav: navFalso({ puede: false }), tactil: true, descargar }), 'descargado');
  assert.equal(await compartirOGuardar(png(), 't', { nav: null, tactil: true, descargar }), 'descargado');
  assert.equal(bajadas.length, 3);
  assert.equal(puedeCompartirArchivo(png(), { share: undefined as never, canShare: undefined as never }), false);
  assert.equal(ofreceCompartir({ tactil: true, nav: navFalso() }), true);
  assert.equal(ofreceCompartir({ tactil: false, nav: navFalso() }), false);
});
