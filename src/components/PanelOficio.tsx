import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Oficio } from '@/types/database.types';
import {
  Wrench,
  Siren,
  Save,
  ExternalLink,
  LogOut,
  CheckCircle,
  AlertCircle,
  Phone,
  MapPin,
  Award,
  Clock,
  CreditCard,
  ImagePlus,
  Trash2,
  Share2,
  Sparkles,
  Home,
  Camera,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PanelOficioProps {
  oficioInicial: Oficio;
  onSignOut: () => void;
}

const MEDIOS_PAGO_OPCIONES = [
  'Efectivo',
  'Transferencia',
  'Mercado Pago',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
];

export const PanelOficio: React.FC<PanelOficioProps> = ({ oficioInicial, onSignOut }) => {
  const [oficio, setOficio] = useState<Oficio>(oficioInicial);
  const [nombre, setNombre] = useState(oficioInicial.nombre || '');
  const [oficioRubro, setOficioRubro] = useState(oficioInicial.oficio_rubro || '');
  const [descripcionCorta, setDescripcionCorta] = useState(oficioInicial.descripcion_corta || '');
  const [descripcionCompleta, setDescripcionCompleta] = useState(oficioInicial.descripcion_completa || '');
  const [whatsapp, setWhatsapp] = useState(oficioInicial.whatsapp || '');
  const [telefono, setTelefono] = useState(oficioInicial.telefono || '');
  const [zonaCobertura, setZonaCobertura] = useState(oficioInicial.zona_cobertura || 'Nogoyá y alrededores');
  const [matricula, setMatricula] = useState(oficioInicial.matricula || '');
  const [horarioTexto, setHorarioTexto] = useState(oficioInicial.horario_texto || '');
  const [aDomicilio, setADomicilio] = useState(Boolean(oficioInicial.a_domicilio));
  const [urgencias24hs, setUrgencias24hs] = useState(Boolean(oficioInicial.urgencias_24hs));
  const [serviciosTexto, setServiciosTexto] = useState((oficioInicial.servicios || []).join('\n'));
  const [mediosPago, setMediosPago] = useState<string[]>(oficioInicial.medios_pago || ['Efectivo', 'Transferencia']);
  const [fotoUrl, setFotoUrl] = useState(oficioInicial.foto_url || '');
  const [galeria, setGaleria] = useState<string[]>(oficioInicial.galeria_urls || []);

  const [guardando, setGuardando] = useState(false);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [cambiandoUrgencia, setCambiandoUrgencia] = useState(false);

  const toggleMedioPago = (medio: string) => {
    setMediosPago((prev) =>
      prev.includes(medio) ? prev.filter((m) => m !== medio) : [...prev, medio]
    );
  };

  // Switch instantáneo para Urgencias 24hs
  const handleToggleUrgencias = async () => {
    const nuevoEstado = !urgencias24hs;
    setCambiandoUrgencia(true);
    setUrgencias24hs(nuevoEstado);

    const { error } = await supabase
      .from('oficios')
      .update({ urgencias_24hs: nuevoEstado })
      .eq('id', oficio.id);

    setCambiandoUrgencia(false);

    if (error) {
      setUrgencias24hs(!nuevoEstado);
      alert('No se pudo actualizar el estado de guardia 24hs: ' + error.message);
    } else {
      setOficio((prev) => ({ ...prev, urgencias_24hs: nuevoEstado }));
    }
  };

  const handleGuardarDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !oficioRubro.trim() || !descripcionCorta.trim()) {
      alert('Completá nombre, rubro del oficio y descripción corta.');
      return;
    }

    setGuardando(true);
    const listaServicios = serviciosTexto
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const dbPayload = {
      nombre: nombre.trim(),
      oficio_rubro: oficioRubro.trim(),
      descripcion_corta: descripcionCorta.trim(),
      descripcion_completa: descripcionCompleta.trim() || null,
      whatsapp: whatsapp.trim(),
      telefono: telefono.trim() || null,
      zona_cobertura: zonaCobertura.trim() || 'Nogoyá',
      matricula: matricula.trim() || null,
      horario_texto: horarioTexto.trim() || null,
      a_domicilio: aDomicilio,
      urgencias_24hs: urgencias24hs,
      servicios: listaServicios,
      medios_pago: mediosPago,
      foto_url: fotoUrl || null,
      galeria_urls: galeria,
    };

    const { error } = await supabase
      .from('oficios')
      .update(dbPayload)
      .eq('id', oficio.id);

    setGuardando(false);

    if (error) {
      alert('Error al guardar los cambios: ' + error.message);
    } else {
      setOficio((prev) => ({
        ...prev,
        nombre: dbPayload.nombre,
        oficio_rubro: dbPayload.oficio_rubro,
        descripcion_corta: dbPayload.descripcion_corta,
        descripcion_completa: dbPayload.descripcion_completa ?? undefined,
        whatsapp: dbPayload.whatsapp,
        telefono: dbPayload.telefono ?? undefined,
        zona_cobertura: dbPayload.zona_cobertura,
        matricula: dbPayload.matricula ?? undefined,
        horario_texto: dbPayload.horario_texto ?? undefined,
        a_domicilio: dbPayload.a_domicilio,
        urgencias_24hs: dbPayload.urgencias_24hs,
        servicios: dbPayload.servicios,
        medios_pago: dbPayload.medios_pago,
        foto_url: dbPayload.foto_url ?? undefined,
        galeria_urls: dbPayload.galeria_urls,
      }));
      alert('✅ Tus datos se actualizaron correctamente.');
    }
  };

  const handleSubirAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendoAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `oficios/${oficio.id}/perfil_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('comercios')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comercios')
        .getPublicUrl(filePath);

      const nuevaUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from('oficios')
        .update({ foto_url: nuevaUrl })
        .eq('id', oficio.id);

      if (dbError) throw dbError;

      setFotoUrl(nuevaUrl);
      setOficio((prev) => ({ ...prev, foto_url: nuevaUrl }));
    } catch (err: any) {
      alert('No se pudo subir la foto de perfil: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSubiendoAvatar(false);
      e.target.value = '';
    }
  };

  const handleSubirFotoTrabajo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (galeria.length >= 8) {
      alert('Podés subir hasta 8 fotos de tus trabajos.');
      return;
    }

    setSubiendoFoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `oficios/${oficio.id}/trabajo_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('comercios')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comercios')
        .getPublicUrl(filePath);

      const nuevasFotos = [...galeria, urlData.publicUrl];

      const { error: dbError } = await supabase
        .from('oficios')
        .update({ galeria_urls: nuevasFotos })
        .eq('id', oficio.id);

      if (dbError) throw dbError;

      setGaleria(nuevasFotos);
      setOficio((prev) => ({ ...prev, galeria_urls: nuevasFotos }));
    } catch (err: any) {
      alert('No se pudo subir la imagen: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSubiendoFoto(false);
      e.target.value = '';
    }
  };

  const handleEliminarFoto = async (urlAEliminar: string) => {
    if (!confirm('¿Eliminar esta foto de tu galería de trabajos?')) return;
    const nuevasFotos = galeria.filter((u) => u !== urlAEliminar);

    const { error } = await supabase
      .from('oficios')
      .update({ galeria_urls: nuevasFotos })
      .eq('id', oficio.id);

    if (error) {
      alert('No se pudo eliminar la foto.');
    } else {
      setGaleria(nuevasFotos);
      setOficio((prev) => ({ ...prev, galeria_urls: nuevasFotos }));
    }
  };

  const handleCompartirFicha = () => {
    const url = `${window.location.origin}/oficio/${oficio.slug}`;
    if (navigator.share) {
      navigator.share({
        title: `${oficio.nombre} — ${oficio.oficio_rubro}`,
        text: `Contactá a ${oficio.nombre} en NOGOYORK`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('¡Enlace de tu perfil copiado al portapapeles!');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      {/* CABECERA */}
      <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {fotoUrl ? (
              <img src={fotoUrl} alt={oficio.nombre} className="w-16 h-16 rounded-2xl object-cover border border-gray-200 dark:border-gray-700" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black text-2xl flex items-center justify-center">
                {oficio.nombre.charAt(0).toUpperCase()}
              </div>
            )}
            <label
              className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow cursor-pointer"
              title="Cambiar foto de perfil"
            >
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/*"
                disabled={subiendoAvatar}
                onChange={handleSubirAvatar}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Panel de Oficios
              </span>
              {oficio.habilitado_admin && oficio.aprobado ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" /> Visible en la app
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Pendiente de aprobación
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white mt-1.5 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              {oficio.nombre}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {oficio.oficio_rubro} · {subiendoAvatar ? 'Subiendo foto de perfil...' : 'Editá tus datos y disponibilidad.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCompartirFicha}
            className="px-3.5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> Compartir link
          </button>

          <Link
            to={`/oficio/${oficio.slug}`}
            target="_blank"
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            Ver mi ficha <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>

      {/* SWITCH RÁPIDO URGENCIAS 24HS */}
      <div
        className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          urgencias24hs
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              urgencias24hs
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
            }`}
          >
            <Siren className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              Guardia / Urgencias 24hs
              {urgencias24hs && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-rose-600 text-white rounded-full">
                  Activo
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Cuando está activo, aparecés destacado en <strong>Urgencias 24hs</strong> y primero en el listado de oficios.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={cambiandoUrgencia}
          onClick={handleToggleUrgencias}
          className={`w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-extrabold transition shrink-0 shadow-sm cursor-pointer ${
            urgencias24hs
              ? 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-700'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          {cambiandoUrgencia
            ? 'Actualizando...'
            : urgencias24hs
            ? 'Desactivar Guardia 24hs'
            : 'Activar Guardia 24hs'}
        </button>
      </div>

      {/* FORMULARIO DE DATOS DEL PRESTADOR */}
      <form
        onSubmit={handleGuardarDatos}
        className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5"
      >
        <h3 className="font-bold text-base text-gray-900 dark:text-white border-b dark:border-gray-700 pb-3">
          Información Pública de tu Servicio
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">Nombre o Marca *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Rubro / Oficio principal *</label>
            <input
              type="text"
              required
              placeholder="Ej: Electricista / Gasista / Plomero / Fletes"
              value={oficioRubro}
              onChange={(e) => setOficioRubro(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1">Presentación corta (se ve en las tarjetas) *</label>
            <input
              type="text"
              required
              placeholder="Ej: Instalaciones eléctricas domiciliarias, tableros y urgencias."
              value={descripcionCorta}
              onChange={(e) => setDescripcionCorta(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1">Descripción detallada de tus servicios</label>
            <textarea
              rows={3}
              placeholder="Contá tu experiencia, tipos de trabajos que realizás, presupuestos sin cargo..."
              value={descripcionCompleta}
              onChange={(e) => setDescripcionCompleta(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp de contacto *
            </label>
            <input
              type="tel"
              required
              placeholder="3435123456"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Teléfono para llamadas (Opcional)</label>
            <input
              type="tel"
              placeholder="3435..."
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" /> Zona de cobertura
            </label>
            <input
              type="text"
              placeholder="Ej: Nogoyá y zona rural"
              value={zonaCobertura}
              onChange={(e) => setZonaCobertura(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-500" /> Matrícula habilitante (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Mat. N° 4521"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-500" /> Horarios de atención
            </label>
            <input
              type="text"
              placeholder="Ej: Lun a Sáb de 8:00 a 20:00 hs"
              value={horarioTexto}
              onChange={(e) => setHorarioTexto(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={aDomicilio}
                onChange={(e) => setADomicilio(e.target.checked)}
                className="w-4 h-4 accent-amber-600"
              />
              <Home className="w-4 h-4 text-amber-600" /> Trabaja a domicilio
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1">
              Trabajos específicos que realizás (uno por línea)
            </label>
            <textarea
              rows={3}
              placeholder={'Instalación de aires split\nCarga de gas\nLimpieza y mantenimiento'}
              value={serviciosTexto}
              onChange={(e) => setServiciosTexto(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>

        {/* MEDIOS DE PAGO */}
        <div className="pt-2 border-t dark:border-gray-700 space-y-2">
          <label className="block text-xs font-bold flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-amber-600" /> Medios de pago aceptados
          </label>
          <div className="flex flex-wrap gap-2">
            {MEDIOS_PAGO_OPCIONES.map((medio) => {
              const activo = mediosPago.includes(medio);
              return (
                <button
                  key={medio}
                  type="button"
                  onClick={() => toggleMedioPago(medio)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    activo
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {activo ? '✓ ' : '+ '}
                  {medio}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {guardando ? 'Guardando cambios...' : 'Guardar Cambios'}
        </button>
      </form>

      {/* GALERÍA DE TRABAJOS REALIZADOS */}
      <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-gray-700 pb-3">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Fotos de Trabajos Realizados ({galeria.length}/8)
            </h3>
            <p className="text-xs text-gray-500">
              Subí fotos de tus instalaciones, reparaciones o trabajos terminados.
            </p>
          </div>

          <label className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shrink-0">
            <ImagePlus className="w-4 h-4" />
            {subiendoFoto ? 'Subiendo...' : 'Subir Foto'}
            <input
              type="file"
              accept="image/*"
              disabled={subiendoFoto || galeria.length >= 8}
              onChange={handleSubirFotoTrabajo}
              className="hidden"
            />
          </label>
        </div>

        {galeria.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            Todavía no subiste fotos de tus trabajos.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {galeria.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-900">
                <img src={url} alt={`Trabajo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleEliminarFoto(url)}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow"
                  title="Eliminar foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};