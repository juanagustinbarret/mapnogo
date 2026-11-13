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
} from 'lucide-react';

export const OficioDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [oficio, setOficio] = useState<Oficio | null>(null);
  const [resenas, setResenas] = useState<ResenaOficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

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
    return <div className="max-w-4xl mx-auto p-12 text-center text-gray-500 animate-pulse font-bold">Cargando ficha del prestador...</div>;
  }

  if (!oficio) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center space-y-4">
        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">No encontramos este prestador.</p>
        <Link to="/oficios" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link to="/oficios" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" /> Volver a Oficios
        </Link>

        <button
          type="button"
          onClick={compartirFicha}
          className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-gray-50"
        >
          <Share2 className="w-3.5 h-3.5 text-brand-600" />
          {copiado ? '¡Enlace copiado!' : 'Compartir Ficha'}
        </button>
      </div>

      {/* CABECERA FICHA */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {oficio.foto_url ? (
            <img src={oficio.foto_url} alt={oficio.nombre} className="w-24 h-24 rounded-3xl object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
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
                  <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold">
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
                  <span key={idx} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold capitalize">
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
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 aspect-square">
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
    </div>
  );
};