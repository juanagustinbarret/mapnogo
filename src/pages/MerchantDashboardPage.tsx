import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Comercio, Suscripcion, Promocion } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { obtenerMetricasComercio } from '@/lib/metrics';
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
  Star,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const MerchantDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [metricasReales, setMetricasReales] = useState({ visitas: 0, whatsapp: 0, comoLlegar: 0 });
  const [loading, setLoading] = useState(true);

  // Modal para publicar nueva oferta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    titulo: '',
    descripcion: '',
    precio_anterior: '',
    precio_promocional: '',
  });

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (user) fetchMerchantData();
  }, [user]);

  const fetchMerchantData = async () => {
    setLoading(true);

    // 1. Obtener comercio vinculado al usuario logueado
    let { data: c } = await supabase
      .from('comercios')
      .select('*')
      .eq('propietario_id', user?.id)
      .maybeSingle();

    if (!c && user?.email) {
      const { data: cByEmail } = await supabase
        .from('comercios')
        .select('*')
        .eq('email_comercial', user.email)
        .maybeSingle();
      c = cByEmail;
    }

    if (c) {
      setComercio(c);

      // 2. Cargar métricas REALES registradas en la base de datos
      const met = await obtenerMetricasComercio(c.id);
      setMetricasReales(met);

      // 3. Cargar suscripción activa
      const { data: s } = await supabase
        .from('suscripciones')
        .select('*')
        .eq('comercio_id', c.id)
        .maybeSingle();
      if (s) setSuscripcion(s);

      // 4. Cargar promociones activas
      const { data: p } = await supabase
        .from('promociones')
        .select('*')
        .eq('comercio_id', c.id)
        .order('created_at', { ascending: false });
      if (p) setPromociones(p);

      // 5. Cargar horarios de atención
      const { data: h } = await supabase
        .from('horarios_atencion')
        .select('*')
        .eq('comercio_id', c.id)
        .order('dia_semana', { ascending: true });
      if (h) setHorarios(h);
    }
    setLoading(false);
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;
    setSavingPromo(true);

    const hoy = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(hoy.getDate() + 30);

    const newPromo = {
      comercio_id: comercio.id,
      titulo: promoForm.titulo,
      descripcion: promoForm.descripcion,
      precio_anterior: promoForm.precio_anterior ? parseFloat(promoForm.precio_anterior) : null,
      precio_promocional: promoForm.precio_promocional ? parseFloat(promoForm.precio_promocional) : null,
      fecha_inicio: hoy.toISOString().split('T')[0],
      fecha_fin: fechaFin.toISOString().split('T')[0],
      aprobada: true,
    };

    const { error } = await supabase.from('promociones').insert(newPromo);

    if (error) {
      alert('Error al publicar la oferta: ' + error.message);
    } else {
      setPromoForm({ titulo: '', descripcion: '', precio_anterior: '', precio_promocional: '' });
      setIsModalOpen(false);
      fetchMerchantData();
    }
    setSavingPromo(false);
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('¿Deseás eliminar esta promoción?')) return;
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    if (!error) fetchMerchantData();
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
    if (!error) fetchMerchantData();
  };

  const handleDeleteHorario = async (id: string) => {
    const { error } = await supabase.from('horarios_atencion').delete().eq('id', id);
    if (!error) fetchMerchantData();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Enlace directo de búsqueda en Google Maps para opiniones del local
  const googleReviewUrl = comercio
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio.nombre},${comercio.direccion}, Nogoyá, Entre Ríos`)}`
    : '';

  const qrUrl = comercio
    ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(googleReviewUrl)}`
    : '';

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center text-gray-500 font-bold animate-pulse">
        Cargando panel de control de tu comercio...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* CABECERA PRINCIPAL DEL PANEL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200 dark:border-brand-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Panel del Comercio
            </span>
            {comercio?.habilitado_admin ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 inline-flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" /> Visible en Mapa
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" /> Pendiente de Validación
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2 flex items-center gap-2">
            <Store className="w-7 h-7 text-brand-600" />
            Panel de Control de <span className="text-brand-600">{comercio ? comercio.nombre : 'tu Negocio'}</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gestión de información, promociones, horarios de atención y QR para Google Reseñas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {comercio && (
            <Link
              to={`/comercio/${comercio.slug}`}
              target="_blank"
              className="flex-1 md:flex-none px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition"
            >
              Ver Ficha Pública <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            onClick={handleSignOut}
            className="flex-1 md:flex-none px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS REALES AUDITADAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Visitas a Ficha (Reales)</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{metricasReales.visitas}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Promociones Activas</p>
            <p className="text-3xl font-black text-amber-500 mt-1">{promociones.length}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">QR Google Reseñas</p>
            <p className="text-3xl font-black text-yellow-500 mt-1 flex items-center gap-1">
              5.0 <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 rounded-xl">
            <QrCode className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* INFORMACIÓN DEL COMERCIO + SUSCRIPCIÓN + CÓDIGO QR REVIEWS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DATOS DEL LOCAL */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <Store className="w-5 h-5 text-brand-600" /> Datos Comerciales
            </h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p><strong>Razón / Nombre:</strong> {comercio?.nombre}</p>
              <p><strong>Dirección:</strong> {comercio?.direccion}</p>
              <p><strong>WhatsApp:</strong> {comercio?.whatsapp}</p>
              <p className="line-clamp-2"><strong>Descripción:</strong> {comercio?.descripcion_corta || 'Sin descripción cargada'}</p>
            </div>
          </div>

          <Link
            to="/panel/perfil"
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Edit className="w-4 h-4" /> Editar Datos del Local
          </Link>
        </div>

        {/* ESTADO DE SUSCRIPCIÓN MENSUAL */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" /> Suscripción Mensual
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300">
              {suscripcion?.estado || 'Activa'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500">Monto del Plan:</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(suscripcion?.precio_acordado || 10000)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Próximo Vencimiento:</span>
              <span className="font-bold text-brand-600">{formatDate(suscripcion?.proximo_vencimiento || '')}</span>
            </div>
          </div>
        </div>

        {/* CÓDIGO QR GENERADO PARA GOOGLE MAPS REVIEWS */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <QrCode className="w-5 h-5 text-brand-600" /> QR Reseñas Google Maps
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Imprimí este QR en tu mostrador o mesas. Al escanearlo, tus clientes van directo a dejar calificaciones en Google.
            </p>
          </div>

          {comercio && (
            <div className="flex flex-col items-center gap-2 py-1">
              <img src={qrUrl} alt="QR Google Maps" className="w-28 h-28 p-1.5 bg-white rounded-xl border shadow-sm" />
              <a
                href={qrUrl}
                download={`QR_Resenas_${comercio.slug}.png`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-brand-600 hover:underline inline-flex items-center gap-1"
              >
                Descargar QR listo para imprimir
              </a>
            </div>
          )}
        </div>
      </div>

      {/* HORARIOS DE ATENCIÓN */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
          <Clock className="w-5 h-5 text-brand-600" /> Horarios de Atención al Público
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {diasSemana.map((dia, idx) => {
            const turnosDia = horarios.filter((h) => h.dia_semana === idx);
            return (
              <div key={dia} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700/60">
                <span className="font-bold text-xs text-gray-700 dark:text-gray-300 w-20">{dia}</span>
                <div className="flex-1 flex flex-wrap gap-1 items-center justify-end">
                  {turnosDia.map((t) => (
                    <span key={t.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1">
                      {t.hora_apertura} - {t.hora_cierre}
                      <button onClick={() => handleDeleteHorario(t.id)} className="text-red-500 hover:text-red-700 ml-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => handleAddHorario(idx)} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-300">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PROMOCIONES Y OFERTAS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4">
          <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" /> Mis Ofertas & Promociones
          </h3>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition">
            <PlusCircle className="w-4 h-4" /> Publicar Oferta
          </button>
        </div>

        {promociones.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            No tenés promociones activas. ¡Publicá ofertas para destacar en la app!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {promociones.map((p) => (
              <div key={p.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2 relative">
                <button onClick={() => handleDeletePromo(p.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{p.titulo}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{p.descripcion}</p>
                <div className="text-lg font-extrabold text-green-600">{formatCurrency(p.precio_promocional || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL NUEVA PROMO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Publicar Nueva Oferta</h3>
            <form onSubmit={handleCreatePromo} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Título de la Oferta</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2x1 en Pizzas de Muzza"
                  value={promoForm.titulo}
                  onChange={(e) => setPromoForm({ ...promoForm, titulo: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descripción corta</label>
                <textarea
                  required
                  placeholder="Detalles de la promoción..."
                  value={promoForm.descripcion}
                  onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Precio Promocional ($)</label>
                <input
                  type="number"
                  required
                  placeholder="8500"
                  value={promoForm.precio_promocional}
                  onChange={(e) => setPromoForm({ ...promoForm, precio_promocional: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm dark:bg-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" disabled={savingPromo} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm">Publicar Promo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};