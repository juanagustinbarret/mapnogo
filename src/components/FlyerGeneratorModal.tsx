import React, { useRef, useState } from 'react';
import { Comercio, Promocion } from '@/types/database.types';
import { formatCurrency } from '@/lib/formatters';
import { Download, Sparkles, X } from 'lucide-react';

interface Props {
  comercio: Comercio;
  promociones: Promocion[];
  onClose: () => void;
}

export const FlyerGeneratorModal: React.FC<Props> = ({ comercio, promociones, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [promoSeleccionada, setPromoSeleccionada] = useState<Promocion | null>(
    promociones.length > 0 ? promociones[0] : null
  );

  const generarImagen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensiones para Historia de Instagram (9:16)
    canvas.width = 1080;
    canvas.height = 1920;

    // FONDO DEGRADADO
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, '#064e3b'); // Emerald oscuro
    gradient.addColorStop(0.5, '#047857');
    gradient.addColorStop(1, '#022c22');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // INSIGNIA SUPERIOR
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(140, 150, 800, 100, 50);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOGOMAP • Directorio Comercial', 540, 215);

    // TARJETA CONTENEDORA PRINCIPAL
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(90, 320, 900, 1280, 40);
    ctx.fill();

    // NOMBRE DEL COMERCIO
    ctx.fillStyle = '#111827';
    ctx.font = 'black 72px sans-serif';
    ctx.fillText(comercio.nombre.toUpperCase(), 540, 460);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(comercio.direccion || 'Nogoyá, Entre Ríos', 540, 530);

    // BLOQUE DE LA OFERTA
    if (promoSeleccionada) {
      ctx.fillStyle = '#fef3c7'; // Fondo Amber clarito
      ctx.beginPath();
      ctx.roundRect(150, 620, 780, 550, 30);
      ctx.fill();

      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('¡OFERTA DESTACADA!', 540, 710);

      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 58px sans-serif';
      ctx.fillText(promoSeleccionada.titulo, 540, 810);

      if (promoSeleccionada.precio_promocional) {
        ctx.fillStyle = '#16a34a';
        ctx.font = 'black 110px sans-serif';
        ctx.fillText(formatCurrency(promoSeleccionada.precio_promocional), 540, 960);
      }

      ctx.fillStyle = '#4b5563';
      ctx.font = '36px sans-serif';
      ctx.fillText(promoSeleccionada.descripcion || '', 540, 1080);
    }

    // PIE DE LA TARJETA Y QR
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('¡Contactanos por WhatsApp!', 540, 1280);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(`📱 ${comercio.whatsapp}`, 540, 1360);

    // PIE EXTERNO
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Encontrá más negocios en www.nogoyacerca.com.ar', 540, 1750);
  };

  React.useEffect(() => {
    generarImagen();
  }, [promoSeleccionada]);

  const descargarFlyer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Flyer_Instagram_${comercio.slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" /> Generador de Flyer para Instagram
        </h3>

        {promociones.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1">Elegí la promoción a mostrar:</label>
            <select
              value={promoSeleccionada?.id || ''}
              onChange={(e) => {
                const p = promociones.find((x) => x.id === e.target.value);
                if (p) setPromoSeleccionada(p);
              }}
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
            >
              {promociones.map((p) => (
                <option key={p.id} value={p.id}>{p.titulo}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4 rounded-2xl">
          <canvas ref={canvasRef} className="w-56 h-[398px] rounded-xl shadow-lg border" />
        </div>

        <button
          onClick={descargarFlyer}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition"
        >
          <Download className="w-4 h-4" /> Descargar Flyer en Alta Calidad (PNG)
        </button>
      </div>
    </div>
  );
};