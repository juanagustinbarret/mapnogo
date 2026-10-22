import React, { useEffect, useRef, useState } from 'react';
import { PanelMetricas } from '@/components/PanelMetricas';
import { EditorDelivery } from '@/components/EditorDelivery';
import { GaleriaModerada } from '@/components/GaleriaModerada';
import { finDePausa, horaArgentina } from '@/lib/delivery';
import { rangoDesdeUrl } from '@/lib/rangosFechas';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { QrResenasDiferido, precargarQrResenas } from '@/components/QrResenasDiferido';
import { CONTACTO } from '@/lib/contacto';
import { estadoSuscripcion } from '@/lib/renovacion';
import { RenovarSuscripcion } from '@/components/RenovarSuscripcion';
import { Comercio, Suscripcion } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { obtenerMetricasComercio } from '@/lib/metrics';
import { diasEntre, estaVigente, fechaCalendario, hoyArgentina, sumarDias, textoVencimiento } from '@/lib/fechasArgentina';
import { COLUMNAS_RESENA, estrellasValidas } from '@/lib/resenas';
import { pedirAvisoDePublicaciones } from '@/lib/avisosPromociones';
import {
  REVALIDAR_AL_ENTRAR_MS,
  avisarCambioPanel,
  guardarCachePanel,
  hayQueRevalidar,
  leerCachePanel,
  useCambiosDeOtraSeccion,
  useRevalidarAlVolver,
} from '@/lib/datosPanel';
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
  Copy,
  Save,
  AlertTriangle,
  Send,
  PauseCircle,
  PlayCircle,
  Star,
  MessageSquare,
  Cross,
  FileText
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

// Lo que se guarda en el caché del panel (src/lib/datosPanel.ts)
interface DatosInicioPanel {
  comercio: Comercio;
  suscripcion: Suscripcion | null;
  promociones: any[];
  horarios: any[];
  resenas: any[];
  proximoTurno: string | null;
  metricas: { visitas: number; whatsapp: number; comoLlegar: number } | null;
}

const diasHastaVencer = (s: Suscripcion | null) =>
  s?.proximo_vencimiento ? diasEntre(hoyArgentina(), fechaCalendario(s.proximo_vencimiento)) : null;

// Indicador de carga de una sección (en vez de tapar todo el panel)
const Esqueleto: React.FC<{ className?: string }> = ({ className = 'h-3 w-24' }) => (
  <span className={`inline-block rounded bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} aria-hidden="true" />
);
const BloqueCargando: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="status" aria-label={texto}>
    {[0, 1].map((i) => (
      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-2">
        <Esqueleto className="h-3 w-1/3 block" />
        <Esqueleto className="h-3 w-3/4 block" />
      </div>
    ))}
  </div>
);

export const MerchantDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Si ya se cargó antes (otra sección, el mapa y volver), se muestra al toque
  // y se actualiza por detrás.
  const claveCache = `inicio:${user?.id ?? ''}`;
  const [previo] = useState(() => (user ? leerCachePanel<DatosInicioPanel>(claveCache) : undefined));
  const datosPrevios = previo?.datos;
  const cargadoEn = useRef<number | null>(previo?.en ?? null);
  const cargaEnCurso = useRef(false);
  const cargaPendiente = useRef(false);

  const [comercio, setComercio] = useState<Comercio | null>(() => datosPrevios?.comercio ?? null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(() => datosPrevios?.suscripcion ?? null);
  const [promociones, setPromociones] = useState<any[]>(() => datosPrevios?.promociones ?? []);
  const [horarios, setHorarios] = useState<any[]>(() => datosPrevios?.horarios ?? []);
  const [resenas, setResenas] = useState<any[]>(() => datosPrevios?.resenas ?? []);
  const [proximoTurno, setProximoTurno] = useState<string | null>(() => datosPrevios?.proximoTurno ?? null);
  const esFarmaciaDeTurno = proximoTurno !== null;
  const [savingHorarioId, setSavingHorarioId] = useState<string | null>(null);
  const [savingHorarios, setSavingHorarios] = useState(false);

  const [deliveryPausadoHasta, setDeliveryPausadoHasta] = useState<string | null>(() => datosPrevios?.comercio.delivery_pausado_hasta ?? null);
  const [pausandoDelivery, setPausandoDelivery] = useState(false);
  const [diasParaVencer, setDiasParaVencer] = useState<number | null>(() => diasHastaVencer(datosPrevios?.suscripcion ?? null));

  const [metricasReales, setMetricasReales] = useState(() => datosPrevios?.metricas ?? { visitas: 0, whatsapp: 0, comoLlegar: 0 });
  const [metricasListas, setMetricasListas] = useState(() => !!datosPrevios?.metricas);
  // Pantalla de carga completa: solo la primera vez, hasta saber cuál es el comercio
  const [loading, setLoading] = useState(() => !datosPrevios);
  // Después, cada sección muestra su propio indicador mientras llegan sus datos
  const [cargandoDetalle, setCargandoDetalle] = useState(() => !datosPrevios);

  // ESTADO PARA LA GALERÍA DE FOTOS
  const [galeriaUrls, setGaleriaUrls] = useState<string[]>(() => datosPrevios?.comercio.galeria_urls ?? []);
  const [guardandoGaleria, setGuardandoGaleria] = useState(false);

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

  // Antes dependía de `user` (objeto): Supabase entrega uno nuevo cada vez
  // que la pestaña vuelve a estar visible y el panel recargaba todo.
  useEffect(() => {
    if (!user) return;
    if (!datosPrevios) void fetchMerchantData();
    else if (cargadoEn.current === null || hayQueRevalidar(cargadoEn.current, Date.now(), REVALIDAR_AL_ENTRAR_MS)) {
      void fetchMerchantData({ silencioso: true });
    }
  }, [user?.id]);

  // Volver a la pestaña del navegador: se actualiza por detrás solo si pasó un rato
  useRevalidarAlVolver(
    () => cargadoEn.current,
    () => void fetchMerchantData({ silencioso: true }),
  );
  // Cambios guardados en "Editar datos del local": refrescar por detrás
  useCambiosDeOtraSeccion('inicio', () => void fetchMerchantData({ silencioso: true }));

  // Mantener el caché al día con lo que se ve (incluye cambios locales)
  useEffect(() => {
    if (!user || !comercio || cargandoDetalle) return;
    guardarCachePanel<DatosInicioPanel>(
      claveCache,
      { comercio, suscripcion, promociones, horarios, resenas, proximoTurno, metricas: metricasListas ? metricasReales : null },
      cargadoEn.current ?? Date.now(),
    );
  }, [user, claveCache, comercio, suscripcion, promociones, horarios, resenas, proximoTurno, metricasListas, metricasReales, cargandoDetalle]);

  /** Después de un cambio: actualizar por detrás (sin pantalla de carga) y avisar a la otra sección. */
  const refrescar = () => {
    avisarCambioPanel('inicio');
    return fetchMerchantData({ silencioso: true });
  };

  const fetchMerchantData = async ({ silencioso = false }: { silencioso?: boolean } = {}) => {
    // Una sola carga a la vez; si piden otra mientras tanto, se hace al terminar
    if (cargaEnCurso.current) {
      cargaPendiente.current = true;
      return;
    }
    cargaEnCurso.current = true;
    if (!silencioso) setLoading(true);
    precargarQrResenas().catch(() => {});

    try {
      let { data: c } = await supabase
        .from('comercios')
        .select('*')
        .eq('propietario_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(1)
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
        setDeliveryPausadoHasta(c.delivery_pausado_hasta || null);
        setGaleriaUrls(c.galeria_urls || []);
        // Ya se puede mostrar el panel; el resto llega por secciones
        if (!silencioso) {
          setCargandoDetalle(true);
          setLoading(false);
        }

        obtenerMetricasComercio(c.id)
          .then((m) => {
            setMetricasReales(m);
            setMetricasListas(true);
          })
          .catch((errorMetricas) => console.warn('[panel] No se pudieron leer las métricas:', errorMetricas));

        const pedirPromociones = async () => {
          const consultaConClics = await supabase
            .from('promociones')
            .select('*, metricas_clics:interacciones_ofertas(count)')
            .eq('comercio_id', c.id)
            .order('created_at', { ascending: false });
          if (!consultaConClics.error) return consultaConClics.data;
          const simple = await supabase
            .from('promociones')
            .select('*')
            .eq('comercio_id', c.id)
            .order('created_at', { ascending: false });
          return simple.data;
        };

        const [{ data: s }, p, { data: h }, { data: r }, { data: ft }] = await Promise.all([
          supabase.from('suscripciones').select('*').eq('comercio_id', c.id).maybeSingle(),
          pedirPromociones(),
          supabase.from('horarios_atencion').select('*').eq('comercio_id', c.id).order('dia_semana', { ascending: true }),
          supabase.from('resenas').select(COLUMNAS_RESENA).eq('comercio_id', c.id).order('created_at', { ascending: false }),
          supabase
            .from('farmacias_turno')
            .select('fecha')
            .eq('comercio_id', c.id)
            .gte('fecha', hoyArgentina())
            .order('fecha', { ascending: true })
            .limit(1),
        ]);

        if (s) {
          setSuscripcion(s);
          setDiasParaVencer(diasHastaVencer(s));
        }
        if (p) setPromociones(p);
        if (h) setHorarios(h);
        if (r) setResenas(r);
        setProximoTurno(ft?.[0]?.fecha ?? null);
        cargadoEn.current = Date.now();
      }
    } catch (error) {
      // En una actualización por detrás se sigue mostrando lo que había
      console.error('Error al cargar datos del comercio:', error);
    } finally {
      setLoading(false);
      setCargandoDetalle(false);
      cargaEnCurso.current = false;
      if (cargaPendiente.current) {
        cargaPendiente.current = false;
        void fetchMerchantData({ silencioso: true });
      }
    }
  };

  const handleGuardarGaleria = async (nuevasFotos: string[]) => {
    if (!comercio) return;
    setGuardandoGaleria(true);

    const { error } = await supabase
      .from('comercios')
      .update({ galeria_urls: nuevasFotos })
      .eq('id', comercio.id);

    setGuardandoGaleria(false);

    if (error) {
      alert('Error al guardar la galería: ' + error.message);
    } else {
      setGaleriaUrls(nuevasFotos);
      setComercio({ ...comercio, galeria_urls: nuevasFotos });
      avisarCambioPanel('inicio');
      alert('✅ Galería de fotos actualizada correctamente.');
    }
  };

  const handleQuitarDeTurno = async () => {
    if (!comercio) return;
    if (!confirm('¿Seguro que querés quitar tus próximos turnos de farmacia (desde hoy)?')) return;

    try {
      const { error } = await supabase
        .from('farmacias_turno')
        .delete()
        .eq('comercio_id', comercio.id)
        .gte('fecha', hoyArgentina());

      if (error) {
        alert('Error al quitar la farmacia de turno: ' + error.message);
        return;
      }

      setProximoTurno(null);
      alert('✅ El comercio ya no figura como farmacia de turno.');
      await refrescar();
    } catch (err: any) {
      alert('Ocurrió un error inesperado: ' + err.message);
    }
  };

  const handlePausarDelivery = async (horas: number | 'hoy') => {
    if (!comercio) return;
    setPausandoDelivery(true);
    const fechaHasta = finDePausa(horas);
    const isoFecha = fechaHasta.toISOString();

    const { error } = await supabase
      .from('comercios')
      .update({ delivery_pausado_hasta: isoFecha })
      .eq('id', comercio.id);

    if (!error) {
      setDeliveryPausadoHasta(isoFecha);
      alert(`Delivery pausado hasta las ${horaArgentina(fechaHasta)}`);
    } else {
      alert('Error al actualizar la pausa de delivery.');
    }
    setPausandoDelivery(false);
  };

  const handleReanudarDelivery = async () => {
    if (!comercio) return;
    setPausandoDelivery(true);
    const { error } = await supabase
      .from('comercios')
      .update({ delivery_pausado_hasta: null })
      .eq('id', comercio.id);

    if (!error) {
      setDeliveryPausadoHasta(null);
    } else {
      alert('No se pudo reanudar el delivery: ' + error.message);
    }
    setPausandoDelivery(false);
  };

  const handleCopiarHorarioLunesAViernes = async () => {
    if (!comercio) return;
    const turnosLunes = horarios.filter((h) => Number(h.dia_semana) === 0);

    if (turnosLunes.length === 0) {
      alert('⚠️ Primero agregá al menos un turno en el día Lunes para poder copiarlo.');
      return;
    }

    if (!confirm('¿Querés copiar los horarios del Lunes a los días Martes, Miércoles, Jueves y Viernes?')) return;

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
      await refrescar();
    }
  };

  const handleGuardarTodosLosHorarios = async () => {
    if (!comercio) return;
    setSavingHorarios(true);

    try {
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
      await refrescar();
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
      void refrescar();
      // Aviso a los vecinos suscriptos (lo decide y lo envía el servidor)
      void pedirAvisoDePublicaciones();
    }
    setSavingPromo(false);
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('¿Deseás eliminar esta publicación?')) return;
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    if (error) {
      alert('No se pudo eliminar la publicación: ' + error.message);
      return;
    }
    void refrescar();
  };

  const handleExportarReporte = async () => {
    if (!comercio) return;
    try {
      const { generarReportePDF } = await import('@/lib/generatePdfReport');
      const metricas = metricasListas ? metricasReales : await obtenerMetricasComercio(comercio.id).catch(() => metricasReales);
      generarReportePDF(comercio, metricas, suscripcion, promociones);
    } catch (err: any) {
      alert('No se pudo generar el reporte PDF: ' + (err?.message ?? err));
    }
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
      alert('No se pudo agregar el turno: ' + error.message);
      return;
    }
    void refrescar();
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
    await refrescar();
  };

  const handleDeleteHorario = async (id: string) => {
    const { error } = await supabase.from('horarios_atencion').delete().eq('id', id);
    if (error) {
      alert('No se pudo eliminar el turno: ' + error.message);
      return;
    }
    void refrescar();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const mensajeWhatsAppAdmin = encodeURIComponent(
    `Hola! Adjunto el comprobante de pago para la cuota del comercio: ${comercio?.nombre}`
  );
  const linkWhatsAppAdmin = `https://wa.me/${CONTACTO.whatsappSoporte}?text=${mensajeWhatsAppAdmin}`;

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
      
      {/* ALERTA DE VENCIMIENTO PRÓXIMO */}
      {diasParaVencer !== null && diasParaVencer <= 5 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-black rounded-xl font-extrabold shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {diasParaVencer < 0
                  ? '¡Tu suscripción venció!'
                  : diasParaVencer === 0
                  ? 'Tu suscripción vence hoy'
                  : `Tu suscripción vence en ${diasParaVencer} día${diasParaVencer > 1 ? 's' : ''}`}
              </h4>
              <p className="text-xs text-gray-600 dark:text-amber-200/80 mt-0.5">
                Vencimiento programado: {formatDate(suscripcion?.proximo_vencimiento || '')}. Enviá tu comprobante para mantener la visibilidad en el mapa.
              </p>
            </div>
          </div>

          <a
            href={linkWhatsAppAdmin}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs inline-flex items-center justify-center gap-2 transition shrink-0 shadow-lg"
          >
            <Send className="w-4 h-4" /> Enviar Comprobante por WhatsApp
          </a>
        </div>
      )}

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

      {/* GESTIÓN DE GALERÍA DE FOTOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
        <GaleriaModerada comercioId={comercio.id} galeriaVieja={galeriaUrls} onGuardarGaleriaVieja={handleGuardarGaleria} />
        {guardandoGaleria && (
          <p className="text-xs text-brand-600 font-bold mt-2 animate-pulse">Guardando fotos en Supabase...</p>
        )}
      </div>

      {/* BLOQUE GESTIÓN FARMACIA DE TURNO */}
      {esFarmaciaDeTurno && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300 rounded-xl font-extrabold shrink-0">
              <Cross className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {proximoTurno === hoyArgentina() ? 'Farmacia de turno hoy' : `Próximo turno: ${formatDate(proximoTurno ?? '')}`}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Ese día tu farmacia aparece en el banner de farmacia de turno del mapa público.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuitarDeTurno}
            className="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <Trash2 className="w-4 h-4" /> Quitar de Turno
          </button>
        </div>
      )}

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Visitas a la ficha (total)</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">{metricasListas ? metricasReales.visitas : '…'}</p>
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
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">QR de reseñas</p>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">Listo para imprimir o compartir</p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 rounded-2xl">
            <QrCode className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* MÉTRICAS POR PERÍODO Y EXPORTACIÓN PDF */}
      {comercio && (
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-base sm:text-lg">
              <Eye className="w-5 h-5 text-brand-600" /> Tus métricas
            </h3>

            <button
              type="button"
              onClick={handleExportarReporte}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
            >
              <FileText className="w-4 h-4" /> Descargar Reporte PDF
            </button>
          </div>

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
            {cargandoDetalle ? (
              <Esqueleto className="h-5 w-16" />
            ) : (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${estadoSuscripcion(suscripcion?.estado).clase}`}>
                {estadoSuscripcion(suscripcion?.estado).texto}
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500">Monto del Plan:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {cargandoDetalle ? <Esqueleto /> : suscripcion ? formatCurrency(suscripcion.precio_acordado) : 'Sin datos'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Próximo Vencimiento:</span>
              <span className="font-bold text-brand-600">{cargandoDetalle ? <Esqueleto /> : suscripcion ? formatDate(suscripcion.proximo_vencimiento) : 'Sin datos'}</span>
            </div>
          </div>

          <RenovarSuscripcion
            propietarioId={user?.id}
            actual={{
              id: comercio.id,
              nombre: comercio.nombre,
              direccion: comercio.direccion,
              precio: suscripcion?.precio_acordado ?? null,
              vencimiento: suscripcion?.proximo_vencimiento ?? null,
              estado: suscripcion?.estado ?? null,
            }}
          />
        </div>

        {/* BLOQUE QR REVIEWS Y BOTÓN GENERAR FLYER DE INSTAGRAM */}
        <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <QrCode className="w-5 h-5 text-brand-600" /> QR de reseñas
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Lleva a las reseñas de tu comercio en NOGOYORK. Imprimilo o generá una story para Instagram.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 py-1">
            <QrResenasDiferido slug={comercio.slug} nombre={comercio.nombre} direccion={comercio.direccion} conStory />
          </div>
        </div>
      </div>

      {/* MÓDULO DE RESEÑAS RECIBIDAS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
          <MessageSquare className="w-5 h-5 text-brand-600" /> Opiniones y Calificaciones de Clientes
        </h3>

        {cargandoDetalle ? (
          <BloqueCargando texto="Cargando opiniones" />
        ) : resenas.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">Aún no recibiste opiniones para tu comercio.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resenas.map((r) => (
              <div key={r.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-2 border dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">{r.nombre_usuario}</span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(estrellasValidas(r.estrellas))].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{r.comentario}</p>
                <span className="text-[10px] text-gray-400 block pt-1">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
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

        {cargandoDetalle ? (
          <BloqueCargando texto="Cargando horarios" />
        ) : (
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
        )}
      </div>

      {/* DELIVERY */}
      <div className="space-y-4">
        <EditorDelivery
          comercioId={comercio.id}
          tieneDelivery={Boolean(comercio.tiene_delivery)}
          turnosLocal={horarios}
          onGuardado={(tiene) => setComercio((prev) => (prev ? { ...prev, tiene_delivery: tiene } : prev))}
        />

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Control Temporal de Delivery
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Si la cocina o los repartidores se saturan, podés pausar temporalmente los pedidos.
              </p>
            </div>

            {deliveryPausadoHasta && new Date(deliveryPausadoHasta) > new Date() ? (
              <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4" />
                Pausado hasta las {horaArgentina(deliveryPausadoHasta)}
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4" /> Delivery Activo
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-gray-700">
            {deliveryPausadoHasta && new Date(deliveryPausadoHasta) > new Date() ? (
              <button
                type="button"
                onClick={handleReanudarDelivery}
                disabled={pausandoDelivery}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" /> Reanudar Delivery Ahora
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handlePausarDelivery(1)}
                  disabled={pausandoDelivery}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition"
                >
                  Pausar 1 hora
                </button>
                <button
                  type="button"
                  onClick={() => handlePausarDelivery(2)}
                  disabled={pausandoDelivery}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition"
                >
                  Pausar 2 horas
                </button>
                <button
                  type="button"
                  onClick={() => handlePausarDelivery('hoy')}
                  disabled={pausandoDelivery}
                  className="px-3 py-2 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 text-xs font-bold rounded-xl transition"
                >
                  Pausar por hoy
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PROMOCIONES */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-700 pb-4">
          <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" /> Mis Publicaciones & Rendimiento
          </h3>
          <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition">
            <PlusCircle className="w-4 h-4" /> Publicar Oferta / Novedad
          </button>
        </div>

        {cargandoDetalle ? (
          <BloqueCargando texto="Cargando publicaciones" />
        ) : promociones.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            No tenés publicaciones activas. ¡Publicá ofertas para destacar en la app!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {promociones.map((p) => (
              <div key={p.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 relative flex flex-col justify-between">
                <button onClick={() => handleDeletePromo(p.id)} aria-label={`Eliminar la publicación ${p.titulo}`} title="Eliminar publicación" className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 pr-6">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                      p.tipo === 'novedad' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.tipo === 'novedad' ? 'Novedad' : 'Oferta'}
                    </span>
                    {p.fecha_fin && (
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

                {Array.isArray(p.metricas_clics) && (
                <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800 text-xs">
                  <span className="text-gray-500 flex items-center gap-1 font-medium">
                    <Eye className="w-3.5 h-3.5 text-blue-500" /> Interacciones:
                  </span>
                  <span className="font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {p.metricas_clics?.[0]?.count || 0} clics
                  </span>
                </div>
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

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Al publicar, se avisa con una notificación a los vecinos que activaron "Recibir Ofertas" (como máximo un aviso por día por comercio).
              </p>

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