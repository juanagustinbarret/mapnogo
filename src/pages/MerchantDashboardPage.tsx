import React, { useEffect, useState } from 'react';
import { PanelMetricas } from '@/components/PanelMetricas';
import { rangoDesdeUrl } from '@/lib/rangosFechas';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Comercio, Suscripcion, Promocion } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { obtenerMetricasComercio } from '@/lib/metrics';
import { estaVigente, hoyArgentina, sumarDias, textoVencimiento } from '@/lib/fechasArgentina';
import {
  Store,
  CreditCard,
  Edit,
  ExternalLink,
  Eye,
  Tag,
  PlusCircle,
  QrCode,
  Clock,
  Trash2,
  Plus,
  LogOut,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
  LayoutDashboard,
  Download,
  Image as ImageIcon,
  Copy,
  Save
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export const MerchantDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [savingHorarioId, setSavingHorarioId] = useState<string | null>(null);
  const [savingHorarios, setSavingHorarios] = useState(false);

  const [metricasReales, setMetricasReales] = useState({ visitas: 0, whatsapp: 0, comoLlegar: 0 });
  const [loading, setLoading] = useState(true);

  // Modal para publicar nueva oferta/novedad
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'promocion' as 'promocion' | 'novedad',
    precio_anterior: '',
    precio_promocional: '',
    fecha_fin: '',
  });

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (user) fetchMerchantData();
  }, [user]);

  const fetchMerchantData = async () => {
    setLoading(true);

    try {
      let { data: c } = await supabase
        .from('comercios')
        .select('*')
        .eq('propietario_id', user?.id)
        .maybeSingle();

      if (!c && user?.email) {
        const emailBuscado = user.email.trim().toLowerCase();
        const { data: cByEmail } = await supabase
          .from('comercios')
          .select('*')
          .ilike('email_comercial', emailBuscado)
          .maybeSingle();

        c = cByEmail;

        if (c && user.id) {
          await supabase
            .from('comercios')
            .update({ propietario_id: user.id })
            .eq('id', c.id);
        }
      }

      if (c) {
        setComercio(c);

        const met = await obtenerMetricasComercio(c.id);
        setMetricasReales(met);

        const { data: s } = await supabase.from('suscripciones').select('*').eq('comercio_id', c.id).maybeSingle();
        if (s) setSuscripcion(s);

        const { data: p } = await supabase
          .from('promociones')
          .select('*')
          .eq('comercio_id', c.id)
          .order('created_at', { ascending: false });
        if (p) setPromociones(p);

        const { data: h } = await supabase
          .from('horarios_atencion')
          .select('*')
          .eq('comercio_id', c.id)
          .order('dia_semana', { ascending: true });
        if (h) setHorarios(h);
      }
    } catch (error) {
      console.error('Error al cargar datos del comercio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopiarHorarioLunesAViernes = async () => {
    if (!comercio) return;
    const turnosLunes = horarios.filter((h) => Number(h.dia_semana) === 0);

    if (turnosLunes.length === 0) {
      alert('⚠️ Primero agregá al menos un turno en el día Lunes para poder copiarlo.');
      return;
    }

    if (!confirm('¿Querés copiar los horarios del Lunes a los días Martes, Miércoles, Jueves y Viernes?')) return;

    // Copia de seguridad de Martes a Viernes por si algo falla a mitad de camino.
    // Antes los errores de Supabase no se revisaban (no lanzan excepción): si
    // el alta fallaba después del borrado, se perdían los horarios de esos
    // días y aun así se mostraba "copiados exitosamente".
    const respaldo = horarios.filter((h) => [1, 2, 3, 4].includes(Number(h.dia_semana)));

    const nuevosTurnos = [1, 2, 3, 4].flatMap((dia) =>
      turnosLunes.map((t) => ({
        comercio_id: comercio.id,
        dia_semana: dia,
        hora_apertura: t.hora_apertura,
        hora_cierre: t.hora_cierre,
        activo: t.activo ?? true,
        ...(t.turno !== undefined ? { turno: t.turno } : {}),
        ...(t.cruza_medianoche !== undefined ? { cruza_medianoche: t.cruza_medianoche } : {}),
      }))
    );

    setSavingHorarios(true);
    try {
      const { error: errorBorrado } = await supabase
        .from('horarios_atencion')
        .delete()
        .eq('comercio_id', comercio.id)
        .in('dia_semana', [1, 2, 3, 4]);
      if (errorBorrado) throw errorBorrado;

      const { error: errorAlta } = await supabase.from('horarios_atencion').insert(nuevosTurnos);
      if (errorAlta) {
        const { error: errorRestaurar } = respaldo.length
          ? await supabase.from('horarios_atencion').insert(respaldo)
          : { error: null };
        throw new Error(
          errorRestaurar
            ? `${errorAlta.message}. Además no se pudieron restaurar los horarios anteriores: revisalos.`
            : `${errorAlta.message}. Se dejaron los horarios como estaban.`
        );
      }

      alert('✅ Horarios copiados de Lunes a Viernes exitosamente.');
    } catch (e: any) {
      alert('Error al copiar horarios: ' + e.message);
    } finally {
      setSavingHorarios(false);
      await fetchMerchantData();
    }
  };

  const handleGuardarTodosLosHorarios = async () => {
    if (!comercio) return;
    setSavingHorarios(true);

    try {
      // Antes se informaba "actualizados" aunque alguno fallara.
      const resultados = await Promise.all(
        horarios.map((h) =>
          supabase
            .from('horarios_atencion')
            .update({
              hora_apertura: h.hora_apertura,
              hora_cierre: h.hora_cierre,
              activo: h.activo,
            })
            .eq('id', h.id)
            .eq('comercio_id', comercio.id)
        )
      );
      const fallidos = resultados.filter((r) => r.error);
      if (fallidos.length > 0) {
        alert(`⚠️ No se pudieron guardar ${fallidos.length} de ${horarios.length} turnos: ${fallidos[0].error?.message}`);
      } else {
        alert('✅ Todos los horarios semanales fueron actualizados.');
      }
      await fetchMerchantData();
    } catch (e: any) {
      alert('Error al guardar horarios: ' + e.message);
    } finally {
      setSavingHorarios(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;
    setSavingPromo(true);

    // Fechas en hora de Argentina (en UTC, de 21 a 24 h ya era "mañana").
    // Se guardan como fecha sola (YYYY-MM-DD): la oferta vale hasta el final
    // de ese día en Argentina (ver estaVigente en fechasArgentina.ts).
    const hoy = hoyArgentina();
    const fechaFinCalculada = promoForm.fecha_fin || sumarDias(hoy, 30);
    if (fechaFinCalculada < hoy) {
      alert('La fecha de vencimiento no puede ser anterior a hoy.');
      setSavingPromo(false);
      return;
    }

    const newPromo = {
      comercio_id: comercio.id,
      titulo: promoForm.titulo,
      descripcion: promoForm.descripcion,
      tipo: promoForm.tipo,
      precio_anterior: promoForm.precio_anterior ? parseFloat(promoForm.precio_anterior) : null,
      precio_promocional: promoForm.precio_promocional ? parseFloat(promoForm.precio_promocional) : null,
      fecha_inicio: hoy,
      fecha_fin: fechaFinCalculada,
      aprobada: true,
    };

    const { error } = await supabase.from('promociones').insert(newPromo);

    if (error) {
      alert('Error al publicar: ' + error.message);
    } else {
      setPromoForm({ titulo: '', descripcion: '', tipo: 'promocion', precio_anterior: '', precio_promocional: '', fecha_fin: '' });
      setIsModalOpen(false);
      fetchMerchantData();
    }
    setSavingPromo(false);
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('¿Deseás eliminar esta publicación?')) return;
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    // Antes un error (por ejemplo de permisos) no mostraba nada
    if (error) {
      console.error('[promociones] No se pudo eliminar', error);
      alert('No se pudo eliminar la publicación: ' + error.message);
      return;
    }
    fetchMerchantData();
  };

  // GENERADOR DE FLYER FORMATO HISTORIA DE INSTAGRAM (1080x1920) CON QR DE RESEÑAS
  const handleGenerarFlyerInstagram = () => {
    if (!comercio) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920; // Tamaño estándar de Instagram Story
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Fondo Degradado Oscuro Elegante
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, '#022c22');
    gradient.addColorStop(0.5, '#0f172a');
    gradient.addColorStop(1, '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Marcos Decorativos Superiores e Inferiores
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 0, 1080, 28);
    ctx.fillRect(0, 1892, 1080, 28);

    // 3. Marca Superior / App
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOGOMAP', 540, 220);

    // 4. Nombre del Comercio
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText(comercio.nombre.toUpperCase(), 540, 360);

    // Dirección
    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px sans-serif';
    ctx.fillText(comercio.direccion || 'Nogoyá, Entre Ríos', 540, 430);

    // 5. Contenedor / Tarjeta del QR
    ctx.fillStyle = '#1e293b';
    ctx.roundRect ? ctx.roundRect(140, 520, 800, 950, 40) : ctx.fillRect(140, 520, 800, 950);
    ctx.fill();

    ctx.fillStyle = '#f59e0b'; // Color Ámbar para estrellas
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('★ ★ ★ ★ ★', 540, 610);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('¡DEJANOS TU RESEÑA EN GOOGLE!', 540, 680);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '28px sans-serif';
    ctx.fillText('Escaneá el código con tu celular', 540, 730);

    // 6. Cargar Imagen del QR de Google Maps Reseñas
    const googleReviewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio.nombre},${comercio.direccion}, Nogoyá, Entre Ríos`)}`;
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(googleReviewUrl)}`;

    qrImg.onload = () => {
      // Marco Blanco del QR
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(290, 780, 500, 500);
      ctx.drawImage(qrImg, 310, 800, 460, 460);

      // Texto Inferior
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('Tu opinión nos ayuda a seguir creciendo', 540, 1380);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '28px sans-serif';
      ctx.fillText('www.nogomap.com.ar', 540, 1750);

      // Descarga Automática
      const link = document.createElement('a');
      link.download = `Story_Resenas_${comercio.slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  };

  const handleAddHorario = async (diaIndex: number) => {
    if (!comercio) return;
    const { error } = await supabase.from('horarios_atencion').insert({
      comercio_id: comercio.id,
      dia_semana: diaIndex,
      hora_apertura: '08:00',
      hora_cierre: '12:00',
      activo: true,
    });
    if (error) {
      console.error('[horarios] No se pudo agregar el turno', error);
      alert('No se pudo agregar el turno: ' + error.message);
      return;
    }
    fetchMerchantData();
  };

  const handleUpdateHorario = async (horario: any) => {
    if (!comercio) return;
    setSavingHorarioId(horario.id);

    const { error } = await supabase
      .from('horarios_atencion')
      .update({
        hora_apertura: horario.hora_apertura,
        hora_cierre: horario.hora_cierre,
        activo: horario.activo,
      })
      .eq('id', horario.id)
      .eq('comercio_id', comercio.id);

    setSavingHorarioId(null);

    if (error) {
      alert('No se pudo guardar el horario: ' + error.message);
      return;
    }

    alert('Horario actualizado correctamente.');
    await fetchMerchantData();
  };

  const handleDeleteHorario = async (id: string) => {
    const { error } = await supabase.from('horarios_atencion').delete().eq('id', id);
    if (error) {
      console.error('[horarios] No se pudo eliminar el turno', error);
      alert('No se pudo eliminar el turno: ' + error.message);
      return;
    }
    fetchMerchantData();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const googleReviewUrl = comercio
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio.nombre},${comercio.direccion}, Nogoyá, Entre Ríos`)}`
    : '';

  const qrUrl = comercio
    ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(googleReviewUrl)}`
    : '';

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center text-gray-500 font-bold animate-pulse">
        Cargando panel de control de tu negocio...
      </div>
    );
  }

  if (!comercio) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl inline-block">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sin comercio asignado</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tu usuario (<span className="font-semibold">{user?.email}</span>) no tiene un comercio asignado.
        </p>
        <button onClick={handleSignOut} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* CABECERA */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Panel del Comercio
              </span>
              {comercio.habilitado_admin ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" /> Visible
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Pendiente
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white mt-2 flex items-center gap-2">
              <Store className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600" />
              Panel de <span className="text-brand-600">{comercio.nombre}</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gestioná tu local, promociones, horarios y generá folletería para tus redes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Link
              to={`/comercio/${comercio.slug}`}
              target="_blank"
              className="flex-1 md:flex-none px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition"
            >
              Ver Ficha Pública <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={handleSignOut}
              className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <div className="flex items-center gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/panel"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition ${
              location.pathname === '/panel'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>

          <Link
            to="/panel/perfil"
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition ${
              location.pathname === '/panel/perfil'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Edit className="w-4 h-4" /> Editar Datos del Local
          </Link>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Visitas a la ficha (total)</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">{metricasReales.visitas}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Publicaciones Activas</p>
            <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-1">{promociones.length}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">QR Google Reseñas</p>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">Listo para imprimir o compartir</p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 rounded-2xl">
            <QrCode className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* MÉTRICAS POR PERÍODO */}
      {comercio && (
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-600" /> Tus métricas
          </h3>
          <PanelMetricas comercioId={comercio.id} rangoInicial={rangoDesdeUrl(location.search)} />
        </div>
      )}

      {/* BLOQUES INFORMACIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DATOS COMERCIALES */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <Store className="w-5 h-5 text-brand-600" /> Datos Comerciales
            </h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p><strong>Nombre:</strong> {comercio.nombre}</p>
              <p><strong>Dirección:</strong> {comercio.direccion || 'Sin cargar'}</p>
              <p><strong>WhatsApp:</strong> {comercio.whatsapp || 'Sin cargar'}</p>
            </div>
          </div>

          <Link
            to="/panel/perfil"
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Edit className="w-4 h-4" /> Editar Datos
          </Link>
        </div>

        {/* SUSCRIPCIÓN */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" /> Suscripción
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
              {suscripcion?.estado || 'Activa'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500">Monto del Plan:</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(suscripcion?.precio_acordado || 10000)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Próximo Vencimiento:</span>
              <span className="font-bold text-brand-600">{formatDate(suscripcion?.proximo_vencimiento || '')}</span>
            </div>
          </div>
        </div>

        {/* BLOQUE QR REVIEWS Y BOTÓN GENERAR FLYER DE INSTAGRAM */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <QrCode className="w-5 h-5 text-brand-600" /> QR Google Reseñas
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Llevá tus reseñas a otro nivel. Imprimí el QR o generá un flyer listo para publicar en las historias de tu negocio.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 py-1">
            <img src={qrUrl} alt="QR Google Maps" className="w-28 h-28 p-1.5 bg-white rounded-xl border shadow-sm" />

            <div className="flex flex-col w-full gap-2 pt-1">
              <a
                href={qrUrl}
                download={`QR_Resenas_${comercio.slug}.png`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Descargar QR solo
              </a>

              {/* BOTÓN GENERADOR DE FLYER FORMATO HISTORIA DE INSTAGRAM */}
              <button
                type="button"
                onClick={handleGenerarFlyerInstagram}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Generar Story para Instagram
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HORARIOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-700 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" /> Horarios de Atención al Público
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Configurá la atención semanal de tu local.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={savingHorarios}
              onClick={handleCopiarHorarioLunesAViernes}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar Lunes a Viernes
            </button>

            <button
              type="button"
              disabled={savingHorarios}
              onClick={handleGuardarTodosLosHorarios}
              className="flex-1 sm:flex-none px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {savingHorarios ? 'Guardando...' : 'Guardar Todos los Cambios'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diasSemana.map((dia, idx) => {
            const turnosDia = horarios.filter(
              (h) => Number(h.dia_semana) === idx
            );

            return (
              <div
                key={dia}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-800 dark:text-white">
                    {dia}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleAddHorario(idx)}
                    className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    Agregar turno
                  </button>
                </div>

                {turnosDia.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Cerrado — no hay turnos cargados.
                  </p>
                ) : (
                  turnosDia.map((turno) => (
                    <div
                      key={turno.id}
                      className="grid grid-cols-2 gap-2 items-end border-t dark:border-gray-700 pt-3"
                    >
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Apertura
                        </label>
                        <input
                          type="time"
                          value={String(turno.hora_apertura).slice(0, 5)}
                          onChange={(e) =>
                            setHorarios((prev) =>
                              prev.map((h) =>
                                h.id === turno.id
                                  ? { ...h, hora_apertura: e.target.value }
                                  : h
                              )
                            )
                          }
                          className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Cierre
                        </label>
                        <input
                          type="time"
                          value={String(turno.hora_cierre).slice(0, 5)}
                          onChange={(e) =>
                            setHorarios((prev) =>
                              prev.map((h) =>
                                h.id === turno.id
                                  ? { ...h, hora_cierre: e.target.value }
                                  : h
                              )
                            )
                          }
                          className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={savingHorarioId === turno.id}
                        onClick={() => handleUpdateHorario(turno)}
                        className="col-span-2 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        {savingHorarioId === turno.id
                          ? 'Guardando...'
                          : 'Guardar horario'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteHorario(turno.id)}
                        className="col-span-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" />
                        Eliminar turno
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PROMOCIONES Y NOVEDADES */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-700 pb-4">
          <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" /> Mis Publicaciones
          </h3>
          <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition">
            <PlusCircle className="w-4 h-4" /> Publicar Oferta / Novedad
          </button>
        </div>

        {promociones.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            No tenés publicaciones activas. ¡Publicá ofertas para destacar en la app!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {promociones.map((p) => (
              <div key={p.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2 relative">
                <button onClick={() => handleDeletePromo(p.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                    p.tipo === 'novedad' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.tipo === 'novedad' ? 'Novedad' : 'Oferta'}
                  </span>
                  {p.fecha_fin && (
                    // Antes mostraba la fecha cruda: "Hasta: 2026-11-17T00:00:00+00:00"
                    <span
                      className={`text-[10px] font-semibold ${
                        !estaVigente(p.fecha_fin)
                          ? 'text-red-500'
                          : textoVencimiento(p.fecha_fin).estaPorVencer
                            ? 'text-amber-600'
                            : 'text-gray-400'
                      }`}
                    >
                      {estaVigente(p.fecha_fin) ? textoVencimiento(p.fecha_fin).texto : `Vencida (${formatDate(p.fecha_fin)})`}
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{p.titulo}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{p.descripcion}</p>
                {p.precio_promocional && (
                  <div className="text-lg font-extrabold text-green-600">{formatCurrency(p.precio_promocional)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL PROMO / NOVEDAD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Publicar Oferta o Novedad</h3>
            <form onSubmit={handleCreatePromo} className="space-y-3">
              
              <div>
                <label className="block text-xs font-semibold mb-1">Tipo de Publicación</label>
                <select
                  value={promoForm.tipo}
                  onChange={(e) => setPromoForm({ ...promoForm, tipo: e.target.value as 'promocion' | 'novedad' })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                >
                  <option value="promocion">Oferta / Descuento</option>
                  <option value="novedad">Novedad / Anuncio General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Título</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2x1 en Pizzas o Ingresó Nueva Colección"
                  value={promoForm.titulo}
                  onChange={(e) => setPromoForm({ ...promoForm, titulo: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descripción corta</label>
                <textarea
                  required
                  placeholder="Detalles del anuncio..."
                  value={promoForm.descripcion}
                  onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              {promoForm.tipo === 'promocion' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Precio Promocional ($)</label>
                  <input
                    type="number"
                    placeholder="8500"
                    value={promoForm.precio_promocional}
                    onChange={(e) => setPromoForm({ ...promoForm, precio_promocional: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  min={hoyArgentina()}
                  value={promoForm.fecha_fin}
                  onChange={(e) => setPromoForm({ ...promoForm, fecha_fin: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
                <span className="text-[10px] text-gray-400">Si se deja vacío, durará 30 días automáticamente.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" disabled={savingPromo} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm">Publicar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};