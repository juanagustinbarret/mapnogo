import { urlQrResenas, dibujarQr, DOMINIO_QR } from '@/lib/qrResenas';

function lienzo(ancho: number, alto: number) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  return { c, ctx };
}

function textoQueEntra(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, ancho: number, tamano: number, minimo: number) {
  ctx.font = `bold ${tamano}px sans-serif`;
  while (ctx.measureText(texto).width > ancho && tamano > minimo) ctx.font = `bold ${(tamano -= 4)}px sans-serif`;
  ctx.fillText(texto, x, y, ancho);
}

/** Story para Instagram (1080×1920) con soporte para Modo Claro y Modo Oscuro */
export function storyCanvasEstilo(slug: string, nombre: string, direccion?: string | null, esOscuro: boolean = true) {
  const { c, ctx } = lienzo(1080, 1920);

  if (esOscuro) {
    // ESTILO OSCURO (ORIGINAL)
    const gradiente = ctx.createLinearGradient(0, 0, 0, 1920);
    gradiente.addColorStop(0, '#022c22');
    gradiente.addColorStop(0.5, '#0f172a');
    gradiente.addColorStop(1, '#020617');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 0, 1080, 28);
    ctx.fillRect(0, 1892, 1080, 28);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('NOGOYORK', 540, 220);

    ctx.fillStyle = '#ffffff';
    textoQueEntra(ctx, nombre.toUpperCase(), 540, 360, 960, 76, 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px sans-serif';
    ctx.fillText(direccion || 'Nogoyá, Entre Ríos', 540, 430, 960);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(140, 520, 800, 950, 40);
    else ctx.rect(140, 520, 800, 950);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('★ ★ ★ ★ ★', 540, 610);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('¡DEJANOS TU RESEÑA!', 540, 680);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '28px sans-serif';
    ctx.fillText('Escaneá el código con tu celular', 540, 730);

    dibujarQr(ctx, urlQrResenas(slug), 290, 780, 500);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Tu opinión nos ayuda a seguir creciendo', 540, 1380);
    ctx.fillStyle = '#64748b';
    ctx.font = '28px sans-serif';
    ctx.fillText(DOMINIO_QR.replace(/^https:\/\//, ''), 540, 1750);
  } else {
    // ESTILO CLARO
    const gradiente = ctx.createLinearGradient(0, 0, 0, 1920);
    gradiente.addColorStop(0, '#f0fdf4');
    gradiente.addColorStop(0.5, '#ffffff');
    gradiente.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, 0, 1080, 28);
    ctx.fillRect(0, 1892, 1080, 28);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('NOGOYORK', 540, 220);

    ctx.fillStyle = '#0f172a';
    textoQueEntra(ctx, nombre.toUpperCase(), 540, 360, 960, 76, 40);

    ctx.fillStyle = '#475569';
    ctx.font = '32px sans-serif';
    ctx.fillText(direccion || 'Nogoyá, Entre Ríos', 540, 430, 960);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(140, 520, 800, 950, 40);
    else ctx.rect(140, 520, 800, 950);
    ctx.fill();

    // Sombra suave para la tarjeta blanca en el modo claro
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('★ ★ ★ ★ ★', 540, 610);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('¡DEJANOS TU RESEÑA!', 540, 680);
    ctx.fillStyle = '#64748b';
    ctx.font = '28px sans-serif';
    ctx.fillText('Escaneá el código con tu celular', 540, 730);

    dibujarQr(ctx, urlQrResenas(slug), 290, 780, 500);

    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Tu opinión nos ayuda a seguir creciendo', 540, 1380);
    ctx.fillStyle = '#64748b';
    ctx.font = '28px sans-serif';
    ctx.fillText(DOMINIO_QR.replace(/^https:\/\//, ''), 540, 1750);
  }

  return c;
}