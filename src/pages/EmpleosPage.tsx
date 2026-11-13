import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { OfertaLaboral, Rubro } from '@/types/database.types';
import { COLUMNAS_LISTADO_COMERCIO } from '@/lib/columnasPublicas';
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { InsigniaRubro } from '@/components/InsigniaRubro';
import {
  Briefcase,
  Search,
  Sparkles,
  Filter,
  MapPin,
  Upload,
  CheckCircle2,
  MessageCircle,
  X,
  Phone,
  User,
  FileText,
  ExternalLink,
  Clock,
  ArrowUp,
} from 'lucide-react';

function tiempoRelativo(fechaIso: string): string {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'Publicado hoy';
  if (dias === 1) return 'Publicado ayer';
  if (dias < 30) return `Hace ${dias} días`;
  return new Date(fechaIso).toLocaleDateString('es-AR');
}

export const EmpleosPage: React.FC = () => {
  const [ofertas, setOfertas] = useState<OfertaLaboral[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');

  // Modal de Postulación
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<OfertaLaboral | null>(null);
  const [nombrePostulante, setNombrePostulante] = useState('');
  const [celularPostulante, setCelularPostulante] = useState('');
  const [archivoCV, setArchivoCV] = useState<File | null>(null);
  const [enviandoCV, setEnviandoCV] = useState(false);
  const [errorPostulacion, setErrorPostulacion] = useState('');
  const [postulacionExitosa, setPostulacionExitosa] = useState<{
    whatsappUrl: string | null;
    comercioNombre: string;
  } | null>(null);

  useEffect(() => {
    const pedirOfertas = (columnas: string) =>
      supabase
        .from('ofertas_laborales')
        .select(`*, comercio:comercios!inner(${columnas}, rubro:rubros(*))` as '*')
        .eq('activa', true)
        .eq('comercio.aprobado', true)
        .eq('comercio.habilitado_admin', true)
        .order('created_at', { ascending: false });

    const cargarTodo = async () => {
      setLoading(true);
      const { data: rubrosData } = await supabase
        .from('rubros')
        .select('*')
        .eq('estado', true)
        .order('orden');
      if (rubrosData) setRubros(rubrosData);

      let { data, error } = await pedirOfertas(COLUMNAS_LISTADO_COMERCIO);
      if (error) ({ data, error } = await pedirOfertas('*'));

      if (error) console.error('[empleos] No se pudieron cargar las ofertas laborales:', error);
      if (data) setOfertas(data as unknown as OfertaLaboral[]);
      setLoading(false);
    };

    void cargarTodo();
  }, []);

  const rubrosConEmpleos = useMemo(() => {
    const ids = new Set(
      ofertas.map((o) => o.comercio?.rubro_id || o.comercio?.rubro?.id).filter(Boolean)
    );
    return rubros
      .map((r) => ({
        ...r,
        cantidad: ofertas.filter((o) => (o.comercio?.rubro_id || o.comercio?.rubro?.id) === r.id).length,
      }))
      .filter((r) => ids.has(r.id));
  }, [rubros, ofertas]);

  const ofertasFiltradas = ofertas.filter((o) => {
    const texto = search.toLowerCase().trim();
    const coincideTexto =
      !texto ||
      o.titulo?.toLowerCase().includes(texto) ||
      o.descripcion?.toLowerCase().includes(texto) ||
      o.comercio?.nombre?.toLowerCase().includes(texto) ||
      o.comercio?.rubro?.nombre?.toLowerCase().includes(texto);

    const rubroIdComercio = o.comercio?.rubro_id || o.comercio?.rubro?.id;
    const coincideRubro = !selectedRubro || rubroIdComercio === selectedRubro;

    return coincideTexto && coincideRubro;
  });

  const abrirModalPostulacion = (oferta: OfertaLaboral) => {
    setOfertaSeleccionada(oferta);
    setNombrePostulante('');
    setCelularPostulante('');
    setArchivoCV(null);
    setErrorPostulacion('');
    setPostulacionExitosa(null);
  };

  const cerrarModal = () => {
    if (enviandoCV) return;
    setOfertaSeleccionada(null);
    setPostulacionExitosa(null);
  };

  const handleEnviarPostulacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaSeleccionada) return;

    const nombreLimpio = nombrePostulante.trim();
    const celularLimpio = celularPostulante.trim();

    if (!nombreLimpio || !celularLimpio) {
      setErrorPostulacion('Completá tu nombre completo y tu número de celular.');
      return;
    }

    if (!archivoCV) {
      setErrorPostulacion('Adjuntá tu currículum (PDF, imagen, Word, etc.).');
      return;
    }

    if (archivoCV.size > 15 * 1024 * 1024) {
      setErrorPostulacion('El archivo supera el límite de 15 MB.');
      return;
    }

    setEnviandoCV(true);
    setErrorPostulacion('');

    try {
      const ext = archivoCV.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'pdf';
      const nombreUnico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const rutaStorage = `${ofertaSeleccionada.comercio_id}/${ofertaSeleccionada.id}/${nombreUnico}`;

      // 1. Subir archivo al bucket privado 'curriculums'
      const { error: errorUpload } = await supabase.storage
        .from('curriculums')
        .upload(rutaStorage, archivoCV, {
          cacheControl: '3600',
          upsert: false,
        });

      if (errorUpload) throw errorUpload;

      // 2. Guardar registro de la postulación en la base de datos
      const { error: errorInsert } = await supabase.from('postulaciones_cv').insert({
        oferta_id: ofertaSeleccionada.id,
        comercio_id: ofertaSeleccionada.comercio_id,
        nombre_postulante: nombreLimpio,
        celular: celularLimpio,
        archivo_path: rutaStorage,
        archivo_nombre: archivoCV.name,
      });

      if (errorInsert) throw errorInsert;

      // 3. Preparar enlace directo de WhatsApp al comercio
      const comercio = ofertaSeleccionada.comercio;
      const wpInfo = normalizeWhatsAppNumber(comercio?.whatsapp ?? '');
      let whatsappUrl: string | null = null;

      if (wpInfo.isValid || /\d/.test(comercio?.whatsapp ?? '')) {
        const destino = wpInfo.isValid ? wpInfo.normalized : (comercio?.whatsapp ?? '');
        const mensaje = `Hola *${comercio?.nombre}*! 👋 Me postulé desde *NOGOYORK* para el puesto de *${ofertaSeleccionada.titulo}*.\n\n👤 *Nombre:* ${nombreLimpio}\n📱 *Celular:* ${celularLimpio}\n📄 Ya dejé mi currículum cargado en su panel (si querés también te lo adjunto por acá). ¡Muchas gracias!`;
        whatsappUrl = buildWhatsAppUrl(destino, mensaje);
      }

      setPostulacionExitosa({
        whatsappUrl,
        comercioNombre: comercio?.nombre || 'el comercio',
      });
    } catch (err: any) {
      console.error('Error enviando postulación:', err);
      setErrorPostulacion(err?.message || 'No se pudo enviar tu currículum. Probá de nuevo.');
    } finally {
      setEnviandoCV(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      {/* BANNER PRINCIPAL */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-brand-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-sky-200" /> Bolsa de Trabajo Local
        </div>
        <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-sky-200" /> Ofertas Laborales en Nogoyá
        </h1>
        <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
          Postulate directamente a los comercios locales sin necesidad de crear una cuenta. Subí tu CV y contactalos al instante.
        </p>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO POR RUBRO */}
      <div className="bg-white dark:bg-gray-800/90 rounded-3xl p-4 shadow-sm border border-gray-200 dark:border-gray-700/80 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por puesto, tareas, requisitos o comercio (ej. Cajero, Cocina, Ventas)..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
          />
        </div>

        <div className="relative w-full sm:w-72 shrink-0">
          <div className="absolute left-3.5 top-3.5 pointer-events-none text-gray-400">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <select
            value={selectedRubro}
            onChange={(e) => setSelectedRubro(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Rubro: Todos ({ofertas.length})</option>
            {rubrosConEmpleos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} ({r.cantidad})
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-3.5 pointer-events-none text-gray-400 text-[10px]">
            ▼
          </div>
        </div>
      </div>

      {/* LISTADO DE BÚSQUEDAS LABORALES */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Cargando búsquedas laborales activas en Nogoyá...
        </div>
      ) : ofertasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl text-center text-gray-500 border border-gray-200 dark:border-gray-700 space-y-3">
          <Briefcase className="w-12 h-12 mx-auto opacity-30 text-blue-500" />
          <p className="text-sm font-semibold">
            {search || selectedRubro
              ? 'No se encontraron búsquedas laborales con esos filtros.'
              : 'Por el momento no hay búsquedas laborales publicadas. ¡Volvé a revisar pronto!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ofertasFiltradas.map((oferta) => (
            <article
              key={oferta.id}
              className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-500 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Encabezado comercio */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/comercio/${oferta.comercio?.slug}`}
                      className="text-xs font-extrabold text-brand-600 hover:underline inline-flex items-center gap-1.5"
                    >
                      {oferta.comercio?.rubro && <InsigniaRubro rubro={oferta.comercio.rubro} />}
                      <span>{oferta.comercio?.nombre}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    {oferta.comercio?.direccion && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" /> {oferta.comercio.direccion}
                      </p>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {tiempoRelativo(oferta.created_at)}
                  </span>
                </div>

                {/* Título / Puesto */}
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-snug">
                  {oferta.titulo}
                </h2>

                {/* Descripción completa (horarios, tareas, requisitos) */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/80 rounded-2xl border border-gray-100 dark:border-gray-700/70">
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {oferta.descripcion}
                  </p>
                </div>
              </div>

              {/* Botón de acción */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => abrirModalPostulacion(oferta)}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition active:scale-[0.99] cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Postularme y Subir CV
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* BOTÓN IR ARRIBA */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <ArrowUp className="w-4 h-4 text-blue-600" /> Volver arriba
        </button>
      </div>

      {/* MODAL PARA ENVIAR CV (SIN REGISTRO) */}
      {ofertaSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full max-h-[92dvh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 border-b dark:border-gray-700 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {ofertaSeleccionada.comercio?.nombre}
                </span>
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                  {ofertaSeleccionada.titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                disabled={enviandoCV}
                aria-label="Cerrar"
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {postulacionExitosa ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-gray-900 dark:text-white">
                    ¡Currículum enviado!
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    Tu CV ya quedó guardado de forma privada en el panel de{' '}
                    <strong>{postulacionExitosa.comercioNombre}</strong> junto con tu número de celular.
                  </p>
                </div>

                {postulacionExitosa.whatsappUrl && (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      ¿Querés avisarles o mandarles tu CV también por WhatsApp?
                    </p>
                    <a
                      href={postulacionExitosa.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <MessageCircle className="w-4 h-4" /> Enviar aviso por WhatsApp
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={cerrarModal}
                  className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition"
                >
                  Listo, volver a empleos
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarPostulacion} className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No necesitás registrarte. Tu currículum será visto <strong>únicamente por el comercio</strong>.
                </p>

                {errorPostulacion && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-300"
                  >
                    {errorPostulacion}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Tu Nombre y Apellido *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ej: María Gómez"
                      value={nombrePostulante}
                      onChange={(e) => setNombrePostulante(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs dark:bg-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Tu Celular (WhatsApp) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="Ej: 3435 123456"
                      value={celularPostulante}
                      onChange={(e) => setCelularPostulante(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs dark:bg-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Adjuntar Currículum (PDF, PNG, JPG, Word, etc.) *
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1.5 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 rounded-2xl cursor-pointer bg-gray-50 dark:bg-gray-900/60 transition text-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 break-all">
                      {archivoCV ? archivoCV.name : 'Tocá para seleccionar tu archivo'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Acepta PDF, imágenes (PNG/JPG), Word, etc. (máx. 15 MB)
                    </span>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
                      onChange={(e) => setArchivoCV(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    disabled={enviandoCV}
                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviandoCV}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    {enviandoCV ? 'Subiendo CV...' : 'Enviar Currículum'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};