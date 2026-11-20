// src/lib/cartelQr.ts

function dibujarRectanguloRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dividirLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxWidth: number
): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let lineaActual = '';

  for (const palabra of palabras) {
    const prueba = lineaActual ? `${lineaActual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= maxWidth) {
      lineaActual = prueba;
    } else {
      if (lineaActual) lineas.push(lineaActual);
      lineaActual = palabra;
    }
  }
  if (lineaActual) lineas.push(lineaActual);
  return lineas;
}

function cargarImagen(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function generarCartelQrNogoyork(
  nombre: string,
  slug: string,
  urlFicha: string
): Promise<void> {
  const W = 1200;
  const H = 1680;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Fondo crema cálido (#F5F3EB)
  ctx.fillStyle = '#F5F3EB';
  ctx.fillRect(0, 0, W, H);

  // 2. Formas orgánicas verde salvia en esquinas superior izquierda e inferior derecha
  ctx.fillStyle = '#DCE3D5';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(340, 0);
  ctx.bezierCurveTo(300, 120, 140, 190, 0, 290);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W, H);
  ctx.lineTo(840, H);
  ctx.bezierCurveTo(880, H - 130, 1040, H - 200, W, H - 310);
  ctx.closePath();
  ctx.fill();

  // 3. Grillas de puntos decorativos (3x3 arriba derecha y abajo izquierda)
  ctx.fillStyle = '#CBD3C3';
  const dibujarGrillaPuntos = (startX: number, startY: number) => {
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(startX + col * 38, startY + fila * 38, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  dibujarGrillaPuntos(W - 155, 72);
  dibujarGrillaPuntos(72, H - 165);

  // 4. Pin de ubicación superior (#0F172A)
  const pinX = W / 2;
  const pinTopY = 64;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(pinX, pinTopY + 46, 46, Math.PI * 0.82, Math.PI * 0.18, false);
  ctx.lineTo(pinX, pinTopY + 132);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F5F3EB';
  ctx.beginPath();
  ctx.arc(pinX, pinTopY + 46, 17, 0, Math.PI * 2);
  ctx.fill();

  // 5. Título del comercio / emprendimiento / oficio en mayúsculas
  const tituloTexto = nombre.trim().toUpperCase();
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 58;
  ctx.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(tituloTexto).width > W - 180 && fontSize > 40) {
    fontSize -= 2;
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  }

  const lineasTitulo = dividirLineas(ctx, tituloTexto, W - 180).slice(0, 2);
  const tituloYBase = lineasTitulo.length === 1 ? 265 : 245;
  lineasTitulo.forEach((linea, i) => {
    ctx.fillText(linea, W / 2, tituloYBase + i * (fontSize + 12));
  });

  // 6. Tarjeta blanca central con borde suave
  const cardSize = 740;
  const cardX = (W - cardSize) / 2;
  const cardY = 365;
  dibujarRectanguloRedondeado(ctx, cardX, cardY, cardSize, cardSize, 52);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#E2DFD5';
  ctx.stroke();

  // 7. Código QR dentro de la tarjeta
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=0&data=${encodeURIComponent(
    urlFicha
  )}`;
  const qrImg = await cargarImagen(qrDataUrl, true);
  const qrSize = 550;
  const qrX = (W - qrSize) / 2;
  const qrY = cardY + (cardSize - qrSize) / 2;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // 8. Texto de llamado a la acción
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ESCANEÁ → CONOCÉ NUESTRA FICHA → DEJANOS TU OPINIÓN', W / 2, 1210);

  // 9. Isotipo NOGOYORK (cuadrado verde #15803D + ícono/logo)
  const badgeSize = 144;
  const badgeX = (W - badgeSize) / 2;
  const badgeY = 1300;
  dibujarRectanguloRedondeado(ctx, badgeX, badgeY, badgeSize, badgeSize, 32);
  ctx.fillStyle = '#15803D';
  ctx.fill();

  let logoDibujado = false;
  for (const rutaLogo of ['/logo-nogoyork.png', '/icon-192.png', '/logo.png', '/favicon.png']) {
    try {
      const logoImg = await cargarImagen(rutaLogo, false);
      const pad = 16;
      ctx.drawImage(
        logoImg,
        badgeX + pad,
        badgeY + pad,
        badgeSize - pad * 2,
        badgeSize - pad * 2
      );
      logoDibujado = true;
      break;
    } catch {
      // Probar siguiente ruta
    }
  }

  if (!logoDibujado) {
    const mx = badgeX + 26;
    const my = badgeY + 42;
    const mw = 92;
    const mh = 62;

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.moveTo(mx, my + 8);
    ctx.lineTo(mx + mw / 3, my);
    ctx.lineTo(mx + (mw * 2) / 3, my + 8);
    ctx.lineTo(mx + mw, my);
    ctx.lineTo(mx + mw, my + mh - 8);
    ctx.lineTo(mx + (mw * 2) / 3, my + mh);
    ctx.lineTo(mx + mw / 3, my + mh - 8);
    ctx.lineTo(mx, my + mh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(mx + 14, my + 44);
    ctx.quadraticCurveTo(mx + 46, my + 24, mx + 72, my + 32);
    ctx.stroke();
    ctx.setLineDash([]);

    const px = mx + 72;
    const py = my + 16;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(px, py, 10, Math.PI * 0.8, Math.PI * 0.2, false);
    ctx.lineTo(px, py + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 10. Marca "NOGO" en verde (#15803D) + "YORK" en rojo coral (#EF4444)
  ctx.font = '900 66px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const textoNogo = 'NOGO';
  const textoYork = 'YORK';
  const anchoNogo = ctx.measureText(textoNogo).width;
  const anchoYork = ctx.measureText(textoYork).width;
  const inicioX = (W - (anchoNogo + anchoYork)) / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803D';
  ctx.fillText(textoNogo, inicioX, 1515);

  ctx.fillStyle = '#EF4444';
  ctx.fillText(textoYork, inicioX + anchoNogo, 1515);

  // 11. Descargar PNG final
  const link = document.createElement('a');
  link.download = `Cartel_NOGOYORK_${slug}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
