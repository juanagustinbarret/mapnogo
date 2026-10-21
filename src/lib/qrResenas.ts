// src/lib/qrResenas.ts
//
// QR del comercio hacia sus reseñas DENTRO de NOGOYORK. El QR codifica una
// dirección corta y estable, /n/{slug}/resenas, que la app redirige a la
// ficha (#resenas): si mañana cambia la estructura de la web, alcanza con
// mantener esa ruta y los QR ya impresos siguen andando.
//
// Se genera acá, sin servicios externos, con el generador de Nayuki (MIT),
// copiado en src/lib/vendor/qrcodegen.ts.

import { QrCode, QrEcc } from './vendor/qrcodegen';

export { DOMINIO_QR, destinoQrResenas, rutaQrResenas, urlQrResenas } from './rutasQr';

/** Matriz de módulos (true = oscuro). Corrección de errores media (15 %). */
export function matrizQr(texto: string): boolean[][] {
  const qr = QrCode.encodeText(texto, QrEcc.MEDIUM);
  return Array.from({ length: qr.size }, (_, y) => Array.from({ length: qr.size }, (_, x) => qr.getModule(x, y)));
}

/** SVG del QR con margen de 4 módulos (lo que pide el estándar). */
export function svgQr(texto: string, borde = 4): string {
  const m = matrizQr(texto);
  const lado = m.length + borde * 2;
  let camino = '';
  m.forEach((fila, y) =>
    fila.forEach((oscuro, x) => {
      if (oscuro) camino += `M${x + borde},${y + borde}h1v1h-1z`;
    }),
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#ffffff"/><path d="${camino}" fill="#000000"/></svg>`
  );
}

/** Dibuja el QR en un canvas (para PNG). Devuelve el lado en px. */
export function dibujarQr(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, lado: number, borde = 4) {
  const m = matrizQr(texto);
  const modulos = m.length + borde * 2;
  const paso = Math.floor(lado / modulos);
  const real = paso * modulos;
  const dx = x + Math.floor((lado - real) / 2);
  const dy = y + Math.floor((lado - real) / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = '#000000';
  m.forEach((fila, fy) =>
    fila.forEach((oscuro, fx) => {
      if (oscuro) ctx.fillRect(dx + (fx + borde) * paso, dy + (fy + borde) * paso, paso, paso);
    }),
  );
  return real;
}
