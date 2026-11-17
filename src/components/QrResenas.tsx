// src/components/QrResenas.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Printer, Share2, Sun, Moon } from 'lucide-react';
import { DOMINIO_QR, dibujarQr, svgQr, urlQrResenas } from '@/lib/qrResenas';
import { slugLimpio } from '@/lib/rutasQr';
import {
  archivoDesdeCanvas,
  archivoDesdeDataUrl,
  compartirOGuardar,
  descargarArchivo,
  esTactil,
  ofreceCompartir,
  type ResultadoCompartir,
} from '@/lib/compartirImagen';

interface Props {
  slug: string;
  nombre: string;
  /** Para la story (debajo del nombre) */
  direccion?: string | null;
  /** Muestra también el botón de la story para Instagram (panel del comercio) */
  conStory?: boolean;
}

let logo: HTMLImageElement | null = null;
function precargarLogo() {
  if (logo || typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => (logo = img);
  img.src = '/logo.svg';
}

function lienzo(ancho: number, alto: number) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  return { c, ctx };
}

function textoQueEntra(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  tamano: number,
  minimo: number
) {
  ctx.font = `800 ${tamano}px system-ui, -apple-system, sans-serif`;
  while (ctx.measureText(texto).width > ancho && tamano > minimo) {
    tamano -= 4;
    ctx.font = `800 ${tamano}px system-ui, -apple-system, sans-serif`;
  }
  ctx.fillText(texto, x, y, ancho);
}

export function qrCanvas(slug: string, lado = 1024) {
  const { c, ctx } = lienzo(lado, lado);
  dibujarQr(ctx, urlQrResenas(slug), 0, 0, lado);
  return c;
}

/**
 * Cartel A6 vertical (1240 × 1748 px — 300 DPI):
 * Fondo crema #F6F4EC, ondas orgánicas verdes en esquinas, grillas de puntos,
 * pin + nombre arriba, QR centrado, línea única:
 * "ESCANEÁ → CONOCÉ NUESTRA FICHA → DEJANOS TU OPINIÓN"
 * y branding NOGOYORK con isotipo abajo.
 */
export function cartelCanvas(slug: string, nombre: string) {
  const W = 1240;
  const H = 1748;
  const { c, ctx } = lienzo(W, H);

  // 1. Fondo crema suave
  ctx.fillStyle = '#f6f4ec';
  ctx.fillRect(0, 0, W, H);

  // 2. Ondas orgánicas verdes en las esquinas (arriba-izq y abajo-der)
  ctx.fillStyle = '#dce6d5';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(340, 0);
  ctx.bezierCurveTo(300, 140, 150, 170, 0, 290);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W, H);
  ctx.lineTo(W - 360, H);
  ctx.bezierCurveTo(W - 310, H - 150, W - 150, H - 180, W, H - 310);
  ctx.closePath();
  ctx.fill();

  // 3. Grillas de puntitos (3x3) arriba-derecha y abajo-izquierda
  ctx.fillStyle = '#c5d4bc';
  const dibujarGrillaPuntos = (startX: number, startY: number) => {
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(startX + col * 38, startY + fila * 38, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  dibujarGrillaPuntos(W - 155, 75);
  dibujarGrillaPuntos(75, H - 165);

  // 4. Pin de ubicación arriba centrado
  const pinX = W / 2;
  const pinTopY = 65;
  const pinR = 46;
  const pinCircleY = pinTopY + pinR;
  const pinTipY = pinCircleY + 86;

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(pinX, pinCircleY, pinR, Math.PI * 0.82, Math.PI * 0.18, false);
  ctx.lineTo(pinX, pinTipY);
  ctx.closePath();
  ctx.fill();

  // Agujero interior del pin
  ctx.fillStyle = '#f6f4ec';
  ctx.beginPath();
  ctx.arc(pinX, pinCircleY, 17, 0, Math.PI * 2);
  ctx.fill();

  // 5. Nombre del comercio (debajo del pin)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  textoQueEntra(ctx, nombre.toUpperCase(), W / 2, 285, 1060, 62, 34);

  // 6. Tarjeta blanca sutil para el QR (garantiza lectura rápida y estética limpia)
  const qrSize = 690;
  const qrPadding = 35;
  const boxSize = qrSize + qrPadding * 2;
  const boxX = (W - boxSize) / 2;
  const boxY = 370;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxSize, boxSize, 42);
  else ctx.rect(boxX, boxY, boxSize, boxSize);
  ctx.fill();

  ctx.strokeStyle = '#e5e2d5';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Código QR centrado dentro de la tarjeta
  dibujarQr(ctx, urlQrResenas(slug), (W - qrSize) / 2, boxY + qrPadding, qrSize);

  // 7. Llamada a la acción en una sola línea limpia con flechas
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  textoQueEntra(
    ctx,
    'ESCANEÁ → CONOCÉ NUESTRA FICHA → DEJANOS TU OPINIÓN',
    W / 2,
    1255,
    1140,
    33,
    24
  );

  // 8. Isotipo NOGOYORK + Texto bicolor abajo
  const logoSize = 148;
  if (logo) {
    ctx.drawImage(logo, W / 2 - logoSize / 2, 1345, logoSize, logoSize);
  }

  ctx.font = '900 70px system-ui, -apple-system, sans-serif';
  const textoNogo = 'NOGO';
  const textoYork = 'YORK';
  const anchoNogo = ctx.measureText(textoNogo).width;
  const anchoYork = ctx.measureText(textoYork).width;
  const inicioX = W / 2 - (anchoNogo + anchoYork) / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#15803d';
  ctx.fillText(textoNogo, inicioX, 1580);

  ctx.fillStyle = '#ef4444';
  ctx.fillText(textoYork, inicioX + anchoNogo, 1580);

  return c;
}

export function storyCanvas(slug: string, nombre: string, direccion?: string | null, esOscuro: boolean = true) {
  const { c, ctx } = lienzo(1080, 1920);

  if (esOscuro) {
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

const AVISOS: Record<ResultadoCompartir, string> = {
  compartido: 'Listo.',
  cancelado: '',
  descargado: 'Se descargó la imagen.',
};

export const QrResenas: React.FC<Props> = ({ slug, nombre, direccion, conStory = false }) => {
  const url = urlQrResenas(slug);
  const base = slugLimpio(slug) || 'comercio';
  const [aviso, setAviso] = useState('');
  const [modoOscuro, setModoOscuro] = useState(true);
  const compartir = useMemo(() => ofreceCompartir(), []);
  const tactil = useMemo(() => esTactil(), []);

  useEffect(precargarLogo, []);

  const vistaPrevia = useMemo(() => {
    try {
      return qrCanvas(slug, 480).toDataURL('image/png');
    } catch {
      return '';
    }
  }, [slug]);

  const enviar = (armar: () => File, titulo: string) => {
    let archivo: File;
    try {
      archivo = armar();
    } catch {
      setAviso('No se pudo generar la imagen en este dispositivo.');
      return;
    }
    setAviso('');
    compartirOGuardar(archivo, titulo).then((r) => setAviso(AVISOS[r]));
  };

  const forma = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition';
  const boton = `${forma} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100`;
  const Icono = compartir ? Share2 : Download;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {vistaPrevia && (
        <img src={vistaPrevia} alt={`Código QR de ${nombre} en NOGOYORK`} className="w-36 h-36 bg-white rounded-xl border p-1 shadow-sm" />
      )}
      <p className="text-[11px] text-gray-500 text-center break-all">{url.replace(/^https:\/\//, '')}</p>
      {tactil && <p className="text-[11px] text-gray-500 text-center -mt-2">También podés mantener apretado el QR para guardarlo.</p>}
      
      <div className="grid grid-cols-2 gap-2 w-full">
        <button type="button" onClick={() => enviar(() => archivoDesdeCanvas(qrCanvas(slug), `QR_${base}.png`), `QR de ${nombre}`)} className={boton}>
          <Icono className="w-3.5 h-3.5" aria-hidden="true" /> {compartir ? 'Compartir QR' : 'PNG'}
        </button>
        <button
          type="button"
          onClick={() => descargarArchivo(archivoDesdeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgQr(url))}`, `QR_${base}.svg`))}
          className={boton}
          title="Para imprentas: se puede agrandar sin perder calidad"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> SVG
        </button>
        
        <button
          type="button"
          onClick={() => enviar(() => archivoDesdeCanvas(cartelCanvas(slug, nombre), `Cartel_NOGOYORK_${base}.png`), `Cartel QR de ${nombre}`)}
          className={`${forma} col-span-2 bg-brand-600 hover:bg-brand-700 text-white`}
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Cartel para imprimir (A6)
        </button>

        {conStory && (
          <>
            <div className="col-span-2 flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 mt-1">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Estilo de Story:</span>
              <button
                type="button"
                onClick={() => setModoOscuro(!modoOscuro)}
                className="px-2.5 py-1 bg-white dark:bg-gray-700 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-1.5 transition"
              >
                {modoOscuro ? <Moon className="w-3.5 h-3.5 text-emerald-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                {modoOscuro ? 'Modo Oscuro' : 'Modo Claro'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => enviar(() => archivoDesdeCanvas(storyCanvas(slug, nombre, direccion, modoOscuro), `Story_${base}_${modoOscuro ? 'oscuro' : 'claro'}.png`), `Story de ${nombre}`)}
              className={`${forma} col-span-2 ${modoOscuro ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'} text-white shadow-sm`}
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> {compartir ? `Compartir Story (${modoOscuro ? 'Oscura' : 'Clara'})` : `Generar Story (${modoOscuro ? 'Oscura' : 'Clara'})`}
            </button>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-[11px] text-gray-500 min-h-[1em] text-center">{aviso}</p>
    </div>
  );
};

export default QrResenas;