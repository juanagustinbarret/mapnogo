import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { dibujarQr, svgQr, urlQrResenas } from '@/lib/qrResenas';

interface Props {
  slug: string;
  nombre: string;
}

const descargar = (nombreArchivo: string, url: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const cargarImagen = (src: string) =>
  new Promise<HTMLImageElement | null>((listo) => {
    const img = new Image();
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = src;
  });

/** Cartel A6 (1240×1748 px, 300 ppp): nombre, "¡Dejanos tu reseña!", QR y logo de NOGOMAP. */
async function cartelPng(slug: string, nombre: string): Promise<string> {
  const c = document.createElement('canvas');
  c.width = 1240;
  c.height = 1748;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, c.width, 36);
  ctx.fillRect(0, c.height - 36, c.width, 36);

  const logo = await cargarImagen('/logo.svg');
  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, 620 - 70, 110, 140, 140);
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('NOGOMAP', 620, 320);

  ctx.fillStyle = '#111827';
  let tamano = 84;
  ctx.font = `bold ${tamano}px sans-serif`;
  while (ctx.measureText(nombre).width > 1080 && tamano > 40) ctx.font = `bold ${(tamano -= 4)}px sans-serif`;
  ctx.fillText(nombre, 620, 460);

  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('¡Dejanos tu reseña!', 620, 580);
  ctx.fillStyle = '#374151';
  ctx.font = '40px sans-serif';
  ctx.fillText('Escaneá el código con la cámara del celular', 620, 650);

  dibujarQr(ctx, urlQrResenas(slug), 270, 720, 700);

  ctx.fillStyle = '#4b5563';
  ctx.font = '34px sans-serif';
  ctx.fillText(urlQrResenas(slug).replace(/^https:\/\//, ''), 620, 1530);
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('Comercios de Nogoyá en un solo mapa', 620, 1620);
  return c.toDataURL('image/png');
}

/**
 * QR del comercio hacia sus reseñas en NOGOMAP. Lo ven el dueño (en su panel,
 * solo el de su comercio) y el admin. El destino es una página pública, así
 * que el QR no expone nada privado.
 */
export const QrResenas: React.FC<Props> = ({ slug, nombre }) => {
  const url = urlQrResenas(slug);
  const svg = useMemo(() => svgQr(url), [url]);
  const svgUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  const base = `QR_Resenas_${slug}`;

  const bajarPng = () => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    dibujarQr(ctx, url, 0, 0, 1024);
    descargar(`${base}.png`, c.toDataURL('image/png'));
  };

  const boton =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100';

  return (
    <div className="flex flex-col items-center gap-3">
      <img src={svgUrl} alt={`Código QR a las reseñas de ${nombre} en NOGOMAP`} className="w-36 h-36 bg-white rounded-xl border p-1 shadow-sm" />
      <p className="text-[11px] text-gray-500 text-center break-all">{url.replace(/^https:\/\//, '')}</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        <button type="button" onClick={bajarPng} className={boton}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> PNG
        </button>
        <button type="button" onClick={() => descargar(`${base}.svg`, svgUrl)} className={boton}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> SVG
        </button>
        <button
          type="button"
          onClick={async () => descargar(`Cartel_Resenas_${slug}.png`, await cartelPng(slug, nombre))}
          className={`${boton} col-span-2 bg-brand-600 hover:bg-brand-700 text-white dark:bg-brand-600 dark:hover:bg-brand-700`}
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Cartel para imprimir (A6)
        </button>
      </div>
    </div>
  );
};

export { cartelPng };
