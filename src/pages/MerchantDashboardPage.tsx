import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Comercio, Suscripcion, Promocion } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Store,
  CreditCard,
  Edit,
  ExternalLink,
  Eye,
  MessageCircle,
  Tag,
  PlusCircle,
  BarChart2,
  CheckCircle2,
  Calendar,
  Trash2,
  QrCode,
  Clock,
  Sparkles,
  X,
  Share2,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const MerchantDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados Modal Promoción
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

  // 1. Primero busca por propietario_id
  let { data: c } = await supabase
    .from('comercios')
    .select('*')
    .eq('propietario_id', user?.id)
    .maybeSingle();

  // 2. Si no lo encuentra por ID (ej. si fue creado por el admin con email_comercial), busca por email
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
  setLoading(false);
};

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;
    setSavingPromo(true);

    const newPromo = {
      comercio_id: comercio.id,
      titulo: promoForm.titulo,
      descripcion: promoForm.descripcion,
      precio_anterior: promoForm.precio_anterior ? parseFloat(promoForm.precio_anterior) : null,
      precio_promocional: promoForm.precio_promocional ? parseFloat(promoForm.precio_promocional) : null,
      aprobada: true,
    };

    const { error } = await supabase.from('promociones').insert(newPromo);

    if (error) {
      alert('Error al publicar la promoción: ' + error.message);
    } else {
      setPromoForm({ titulo: '', descripcion: '', precio_anterior: '', precio_promocional: '' });
      setIsModalOpen(false);
      fetchMerchantData();
    }
    setSavingPromo(false);
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('¿Deseás eliminar esta oferta?')) return;
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
      activo: true
    });
    if (!error) fetchMerchantData();
  };

  const handleDeleteHorario = async (id: string) => {
    const { error } = await supabase.from('horarios_atencion').delete().eq('id', id);
    if (!error) fetchMerchantData();
  };

  const urlFichaPublica = comercio ? `${window.location.origin}/comercio/${comercio.slug}` : '';
  const qrUrl = comercio
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlFichaPublica)}`
    : '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="w-7 h-7 text-brand-600" />
            Panel de Control de <span className="text-brand-600">{comercio?.nombre || 'tu Negocio'}</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestioná promociones, horarios de atención y descargá tu QR comercial.
          </p>
        </div>

        {comercio && (
          <Link
            to={`/comercio/${comercio.slug}`}
            target="_blank"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition"
          >
            Ver Ficha Pública <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitas Ficha</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">48</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Consultas WhatsApp</p>
            <p className="text-3xl font-bold text-green-600 mt-1">22</p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <MessageCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Promos Activas</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{promociones.length}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* INFORMACIÓN + SUSCRIPCIÓN + CÓDIGO QR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-600" /> Información General
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p><strong>Nombre:</strong> {comercio?.nombre}</p>
            <p><strong>Dirección:</strong> {comercio?.direccion}</p>
            <p><strong>WhatsApp:</strong> {comercio?.whatsapp}</p>
          </div>
          <Link
            to="/panel/perfil"
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition"
          >
            <Edit className="w-4 h-4" /> Editar Datos
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" /> Suscripción
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
              {suscripcion?.estado || 'Activa'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Monto Mensual:</span>
              <span className="font-bold">{formatCurrency(suscripcion?.precio_acordado || 10000)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Próximo Vencimiento:</span>
              <span className="font-bold">{formatDate(suscripcion?.proximo_vencimiento || '')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <QrCode className="w-5 h-5 text-brand-600" /> QR para Mostrador
            </h3>
            <p className="text-xs text-gray-500 mt-2">Tus clientes escanean e ingresan a tus ofertas.</p>
          </div>
          {comercio && (
            <div className="flex flex-col items-center gap-2 py-2">
              <img src={qrUrl} alt="QR" className="w-28 h-28 p-1 bg-white rounded-lg border shadow-sm" />
              <a href={qrUrl} download={`QR_${comercio.slug}.png`} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-600 hover:underline">
                Descargar QR
              </a>
            </div>
          )}
        </div>
      </div>

      {/* MÓDULO DE HORARIOS DE ATENCIÓN */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
          <Clock className="w-5 h-5 text-brand-600" /> Horarios de Atención
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {diasSemana.map((dia, idx) => {
            const turnosDia = horarios.filter((h) => h.dia_semana === idx);
            return (
              <div key={dia} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
                <span className="font-bold text-xs text-gray-700 dark:text-gray-300 w-24">{dia}</span>
                <div className="flex-1 flex flex-wrap gap-1 items-center justify-end">
                  {turnosDia.map((t) => (
                    <span key={t.id} className="bg-white dark:bg-gray-800 border px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1">
                      {t.hora_apertura} - {t.hora_cierre}
                      <button onClick={() => handleDeleteHorario(t.id)} className="text-red-500 hover:text-red-700 ml-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => handleAddHorario(idx)} className="p-1 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LISTA DE PROMOCIONES */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4">
          <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500" /> Mis Promociones Activas
          </h3>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> Publicar Promo
          </button>
        </div>

        {promociones.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">No tenés promociones publicadas.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promociones.map((p) => (
              <div key={p.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border space-y-2 relative">
                <button onClick={() => handleDeletePromo(p.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{p.titulo}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">{p.descripcion}</p>
                <div className="text-lg font-bold text-green-600">{formatCurrency(p.precio_promocional || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Publicar Nueva Promoción</h3>
            <form onSubmit={handleCreatePromo} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Título"
                value={promoForm.titulo}
                onChange={(e) => setPromoForm({ ...promoForm, titulo: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
              />
              <textarea
                required
                placeholder="Descripción"
                value={promoForm.descripcion}
                onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
              />
              <input
                type="number"
                required
                placeholder="Precio Oferta"
                value={promoForm.precio_promocional}
                onChange={(e) => setPromoForm({ ...promoForm, precio_promocional: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" disabled={savingPromo} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold">Publicar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};