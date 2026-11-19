// src/pages/public/OficioDetailPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Oficio, ResenaOficio } from '@/types/database.types';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Phone,
  Siren,
  Award,
  Home,
  Clock,
  MapPin,
  Share2,
  Star,
  CreditCard,
  Wrench,
  QrCode,
  X,
  Download,
} from 'lucide-react';

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

async function generarCartelQrNogoyork(
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

  // 5. Título del prestador / oficio en mayúsculas
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

  // Intentar cargar logo de la app si existe en public/, si no dibujar isotipo de mapa/pin
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
    // Mapa plegado + pin rojo dentro del cuadrado verde
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

    // Pin rojo en el mapa
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

export const OficioDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [oficio, setOficio] = useState<Oficio | null>(null);
  const [resenas, setResenas] = useState<ResenaOficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [modalQrOpen, setModalQrOpen] = useState(false);
  const [descargandoQr, setDescargandoQr] = useState(false);

  // Formulario reseña
  const [autor, setAutor] = useState('');
  const [puntaje, setPuntaje] = useState(5);
  const [comentario, setComentario] = useState('');
  const [enviandoResena, setEnviandoResena] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const cargar = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('oficios')
        .select('*')
        .eq('slug', slug)
        .eq('aprobado', true)
        .eq('habilitado_admin', true)
        .maybeSingle();

      if (data) {
        const ofi = data as Oficio;
        setOficio(ofi);
        const { data: resData } = await supabase
          .from('resenas_oficios')
          .select('*')
          .eq('oficio_id', ofi.id)
          .eq('aprobada', true)
          .order('created_at', { ascending: false });
        if (resData) setResenas(resData as ResenaOficio[]);
      }
      setLoading(false);
    };
    void cargar();
  }, [slug]);

  const compartirFicha = async () => {
    const url = window.location.href;
    if (navigator.share && oficio) {
      try {
        await navigator.share({
          title: `${oficio.nombre} - ${oficio.oficio_rubro} en NOGOYORK`,
          text: oficio.descripcion_corta,
          url,
        });
        return;
      } catch {
        // Fallback a portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const descargarQr = async () => {
    if (!oficio || descargandoQr) return;
    setDescargandoQr(true);
    try {
      await generarCartelQrNogoyork(oficio.nombre, oficio.slug, window.location.href);
    } catch (err) {
      console.error('Error al generar el cartel QR:', err);
      alert('No se pudo generar el cartel QR. Probá nuevamente.');
    } finally {
      setDescargandoQr(false);
    }
  };

  const enviarResena = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oficio || !autor.trim()) return;
    setEnviandoResena(true);
    const { data, error } = await supabase
      .from('resenas_oficios')
      .insert({
        oficio_id: oficio.id,
        autor_nombre: autor.trim(),
        puntaje,
        comentario: comentario.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      setResenas([data as ResenaOficio, ...resenas]);
      setAutor('');
      setComentario('');
      setPuntaje(5);
    }
    setEnviandoResena(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-gray-500 animate-pulse font-bold">
        Cargando ficha del prestador...
      </div>
    );
  }

  if (!oficio) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-4">
        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
          No encontramos este prestador.
        </p>
        <Link
          to="/oficios"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Oficios
        </Link>
      </div>
    );
  }

  const wp = normalizeWhatsAppNumber(oficio.whatsapp);
  const whatsappUrl = wp.isValid
    ? buildWhatsAppUrl(
        wp.normalized,
        `Hola ${oficio.nombre}! Vi tu ficha en *NOGOYORK Oficios* (${oficio.oficio_rubro}) y quería consultarte.`
      )
    : null;

  const promedio =
    resenas.length > 0
      ? (resenas.reduce((acc, r) => acc + r.puntaje, 0) / resenas.length).toFixed(1)
      : null;

  const currentUrl = window.location.href;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/oficios"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-brand-600"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Oficios
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalQrOpen(true)}
            className="px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 rounded-xl transition text-xs font-bold inline-flex items-center gap-1.5"
            title="Ver Código QR de la Ficha"
            aria-label="Ver código QR de la ficha"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR</span>
          </button>

          <button
            type="button"
            onClick={compartirFicha}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-gray-50"
          >
            <Share2 className="w-3.5 h-3.5 text-brand-600" />
            {copiado ? '¡Enlace copiado!' : 'Compartir Ficha'}
          </button>
        </div>
      </div>

      {/* CABECERA FICHA */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {oficio.foto_url ? (
            <img
              src={oficio.foto_url}
              alt={oficio.nombre}
              className="w-24 h-24 rounded-3xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black text-3xl flex items-center justify-center shrink-0">
              {oficio.nombre.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-extrabold uppercase">
                {oficio.oficio_rubro}
              </span>
              {oficio.urgencias_24hs && (
                <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-extrabold inline-flex items-center gap-1">
                  <Siren className="w-3.5 h-3.5" /> Atiende Urgencias 24hs
                </span>
              )}
              {promedio && (
                <span className="px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 text-xs font-bold inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" /> {promedio} ({resenas.length})
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              {oficio.nombre}
              <CheckCircle2 className="w-6 h-6 text-blue-500 shrink-0" />
            </h1>

            {oficio.matricula && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Matrícula habilitante: {oficio.matricula}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-1 text-xs text-gray-600 dark:text-gray-300">
              {oficio.zona_cobertura && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" /> {oficio.zona_cobertura}
                </span>
              )}
              {oficio.horario_texto && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brand-600" /> {oficio.horario_texto}
                </span>
              )}
              {oficio.a_domicilio && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <Home className="w-3.5 h-3.5" /> Trabaja a domicilio
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BOTONES DE CONTACTO DIRECTO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition"
            >
              <MessageCircle className="w-5 h-5" /> Consultar por WhatsApp
            </a>
          )}
          {oficio.telefono && (
            <a
              href={`tel:${oficio.telefono}`}
              className="py-3.5 px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-900 dark:text-white rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 transition"
            >
              <Phone className="w-5 h-5 text-brand-600" /> Llamar: {oficio.telefono}
            </a>
          )}
        </div>

        {/* DESCRIPCIÓN Y ESPECIALIDADES */}
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-500">Sobre el servicio</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
            {oficio.descripcion_completa || oficio.descripcion_corta}
          </p>

          {oficio.servicios && oficio.servicios.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" /> Trabajos que realiza:
              </h3>
              <div className="flex flex-wrap gap-2">
                {oficio.servicios.map((srv, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold"
                  >
                    {srv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {oficio.medios_pago && oficio.medios_pago.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Medios de pago aceptados:
              </h3>
              <div className="flex flex-wrap gap-2">
                {oficio.medios_pago.map((mp, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold capitalize"
                  >
                    {mp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GALERÍA DE TRABAJOS */}
        {oficio.galeria_urls && oficio.galeria_urls.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-500">Trabajos realizados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {oficio.galeria_urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 aspect-square"
                >
                  <img src={url} alt={`Trabajo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RESEÑAS DE VECINOS */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-white">
          Opiniones de vecinos ({resenas.length})
        </h2>

        <form onSubmit={enviarResena} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Tu nombre"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs"
            />
            <select
              value={puntaje}
              onChange={(e) => setPuntaje(Number(e.target.value))}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold"
            >
              <option value={5}>★★★★★ (5 - Excelente)</option>
              <option value={4}>★★★★☆ (4 - Muy bueno)</option>
              <option value={3}>★★★☆☆ (3 - Bueno)</option>
              <option value={2}>★★☆☆☆ (2 - Regular)</option>
              <option value={1}>★☆☆☆☆ (1 - Malo)</option>
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="Contá tu experiencia con el trabajo realizado (opcional)..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs"
          />
          <button
            type="submit"
            disabled={enviandoResena}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold"
          >
            {enviandoResena ? 'Publicando...' : 'Dejar calificación'}
          </button>
        </form>

        <div className="space-y-3">
          {resenas.map((r) => (
            <div key={r.id} className="p-3.5 border border-gray-100 dark:border-gray-700 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-gray-900 dark:text-white">{r.autor_nombre}</span>
                <span className="text-xs font-bold text-amber-500">{'★'.repeat(r.puntaje)}</span>
              </div>
              {r.comentario && <p className="text-xs text-gray-600 dark:text-gray-300">{r.comentario}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL QR DINÁMICO EN PANTALLA */}
      {modalQrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`Código QR de ${oficio.nombre}`}
          onClick={(e) => e.target === e.currentTarget && setModalQrOpen(false)}
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-purple-600" /> Código QR del Servicio
              </h3>
              <button
                type="button"
                onClick={() => setModalQrOpen(false)}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-white rounded-2xl shadow-inner border border-gray-200">
                <img
                  src={qrApiUrl}
                  alt={`QR para acceder a la ficha de ${oficio.nombre}`}
                  className="w-48 h-48 object-contain"
                />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{oficio.nombre}</h4>
                <p className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 mt-0.5">
                  {oficio.oficio_rubro}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 px-3">
                Escaneá este código con la cámara del celular para abrir esta ficha de NOGOYORK directamente.
              </p>
            </div>

            <div className="pt-2 border-t dark:border-gray-700 flex gap-2">
              <button
                type="button"
                disabled={descargandoQr}
                onClick={descargarQr}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                {descargandoQr ? 'Generando cartel...' : 'Descargar PNG'}
              </button>
              <button
                type="button"
                onClick={() => setModalQrOpen(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};