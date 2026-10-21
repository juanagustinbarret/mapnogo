import React, { useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Printer, Share2 } from 'lucide-react';
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

// El logo se precarga al mostrar el QR: el cartel se tiene que dibujar sin
// esperas para que "compartir" siga dentro del toque (lo exige iPhone).
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

/** Achica la letra hasta que el texto entre en el ancho dado. */
function textoQueEntra(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, ancho: number, tamano: number, minimo: number) {
  ctx.font = `bold ${tamano}px sans-serif`;
  while (ctx.measureText(texto).width > ancho && tamano > minimo) ctx.font = `bold ${(tamano -= 4)}px sans-serif`;
  ctx.fillText(texto, x, y, ancho);
}

/** QR solo, en PNG cuadrado. */
export function qrCanvas(slug: string, lado = 1024) {
  const { c, ctx } = lienzo(lado, lado);
  dibujarQr(ctx, urlQrResenas(slug), 0, 0, lado);
  return c;
}

/** Cartel A6 (1240×1748 px, 300 ppp): nombre, "¡Dejanos tu reseña!", QR y logo de NOGOYORK. */
export function cartelCanvas(slug: string, nombre: string) {
  const { c, ctx } = lienzo(1240, 1748);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, c.width, 36);
  ctx.fillRect(0, c.height - 36, c.width, 36);

  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, 620 - 70, 110, 140, 140);
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('NOGOYORK', 620, 320);

  ctx.fillStyle = '#111827';
  textoQueEntra(ctx, nombre, 620, 460, 1080, 84, 40);
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('¡Dejanos tu reseña!', 620, 580);
  ctx.fillStyle = '#374151';
  ctx.font = '40px sans-serif';
  ctx.fillText('Escaneá el código con la cámara del celular', 620, 650);

  dibujarQr(ctx, urlQrResenas(slug), 270, 720, 700);

  ctx.fillStyle = '#4b5563';
  ctx.font = '34px sans-serif';
  ctx.fillText(urlQrResenas(slug).replace(/^https:\/\//, ''), 620, 1530, 1120);
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('Comercios de Nogoyá en un solo mapa', 620, 1620);
  return c;
}

/** Story para Instagram (1080×1920). */
export function storyCanvas(slug: string, nombre: string, direccion?: string | null) {
  const { c, ctx } = lienzo(1080, 1920);
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
  return c;
}

const AVISOS: Record<ResultadoCompartir, string> = {
  compartido: 'Listo.',
  cancelado: '',
  descargado: 'Se descargó la imagen.',
};

/**
 * QR del comercio hacia sus reseñas en NOGOYORK. Lo ven el dueño (en su panel,
 * solo el de su comercio) y el admin. El destino es una página pública, así
 * que el QR no expone nada privado.
 */
export const QrResenas: React.FC<Props> = ({ slug, nombre, direccion, conStory = false }) => {
  const url = urlQrResenas(slug);
  const base = slugLimpio(slug) || 'comercio';
  const [aviso, setAviso] = useState('');
  const compartir = useMemo(() => ofreceCompartir(), []);
  const tactil = useMemo(() => esTactil(), []);

  useEffect(precargarLogo, []);

  // PNG (no SVG) para que en iPhone, manteniendo apretada la imagen, salga
  // "Guardar en Fotos" / "Compartir" como con el QR de antes.
  const vistaPrevia = useMemo(() => {
    try {
      return qrCanvas(slug, 480).toDataURL('image/png');
    } catch {
      return '';
    }
  }, [slug]);

  // Todo sincrónico hasta compartirOGuardar (ver src/lib/compartirImagen.ts)
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

  // Forma común y colores aparte: si se mezclan dos bg-* en la misma clase,
  // gana el que viene después en el CSS y el botón verde quedaba gris.
  const forma = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition';
  const boton = `${forma} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100`;
  const Icono = compartir ? Share2 : Download;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {vistaPrevia && (
        <img src={vistaPrevia} alt={`Código QR a las reseñas de ${nombre} en NOGOYORK`} className="w-36 h-36 bg-white rounded-xl border p-1 shadow-sm" />
      )}
      <p className="text-[11px] text-gray-500 text-center break-all">{url.replace(/^https:\/\//, '')}</p>
      {tactil && <p className="text-[11px] text-gray-500 text-center -mt-2">También podés mantener apretado el QR para guardarlo.</p>}
      <div className="grid grid-cols-2 gap-2 w-full">
        <button type="button" onClick={() => enviar(() => archivoDesdeCanvas(qrCanvas(slug), `QR_Resenas_${base}.png`), `QR de reseñas de ${nombre}`)} className={boton}>
          <Icono className="w-3.5 h-3.5" aria-hidden="true" /> {compartir ? 'Compartir QR' : 'PNG'}
        </button>
        <button
          type="button"
          onClick={() => descargarArchivo(archivoDesdeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgQr(url))}`, `QR_Resenas_${base}.svg`))}
          className={boton}
          title="Para imprentas: se puede agrandar sin perder calidad"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> SVG
        </button>
        <button
          type="button"
          onClick={() => enviar(() => archivoDesdeCanvas(cartelCanvas(slug, nombre), `Cartel_Resenas_${base}.png`), `Cartel de reseñas de ${nombre}`)}
          className={`${forma} col-span-2 bg-brand-600 hover:bg-brand-700 text-white`}
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Cartel para imprimir (A6)
        </button>
        {conStory && (
          <button
            type="button"
            onClick={() => enviar(() => archivoDesdeCanvas(storyCanvas(slug, nombre, direccion), `Story_Resenas_${base}.png`), `Story de reseñas de ${nombre}`)}
            className={`${forma} col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`}
          >
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> {compartir ? 'Compartir Story para Instagram' : 'Generar Story para Instagram'}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-[11px] text-gray-500 min-h-[1em] text-center">{aviso}</p>
    </div>
  );
};

export default QrResenas;
