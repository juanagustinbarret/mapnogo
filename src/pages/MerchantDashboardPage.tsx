import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  LogOut,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
  MessageCircle,
  Navigation,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Comercio, HorarioAtencion, Metricas, Promocion } from '@/types/database.types';
import { formatCurrency, formatDate, formatHora, mensajeError } from '@/lib/formatters';
import { haceDias } from '@/lib/fechas';
import { CIUDAD, PROVINCIA } from '@/config/marca';
import { esVisibleEnMapa, obtenerComercioDelUsuario } from '@/services/comercios';
import { DIAS_SEMANA, listarHorarios } from '@/services/horarios';
import { obtenerMetricas } from '@/services/metricas';
import { crearPromocion, eliminarPromocion, estaVigente, listarPromocionesDeComercio } from '@/services/promociones';

const ESTADO_SUSCRIPCION: Record<string, { texto: string; clase: string }> = {
  activa: { texto: 'Activa', clase: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
  pendiente: { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
  suspendida: { texto: 'Suspendida', clase: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
};

// Motivo por el que el comercio no aparece en el mapa (null si aparece)
const motivoNoVisible = (c: Comercio): string | null => {
  if (esVisibleEnMapa(c)) return null;
  if (!c.aprobado) return 'Pendiente de aprobación';
  if (!c.habilitado_admin) return 'Oculto por el administrador';
  if (!c.suscripcion) return 'Sin suscripción';
  return `Suscripción ${ESTADO_SUSCRIPCION[c.suscripcion.estado]?.texto.toLowerCase() ?? c.suscripcion.estado}`;
};

const PROMO_VACIA = { titulo: '', descripcion: '', precio_anterior: '', precio_promocional: '', dias_vigencia: '30' };

export const MerchantDashboardPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const { avisar, confirmar } = useToast();
  const navigate = useNavigate();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ visitas: 0, whatsapp: 0, comoLlegar: 0 });
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState(PROMO_VACIA);

  const cargarDatos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorCarga('');
    try {
      const c = await obtenerComercioDelUsuario(user.id);
      setComercio(c);
      if (c) {
        const [met, promos, hs] = await Promise.all([
          obtenerMetricas(c.id, haceDias(30)),
          listarPromocionesDeComercio(c.id),
          listarHorarios(c.id),
        ]);
        setMetricas(met);
        setPromociones(promos);
        setHorarios(hs);
      }
    } catch (e) {
      console.error(e);
      setErrorCarga(mensajeError(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const recargarPromociones = async (comercioId: string) => setPromociones(await listarPromocionesDeComercio(comercioId));

  const promosActivas = promociones.filter(estaVigente);
  const limitePromos = comercio?.suscripcion?.plan?.limite_promociones ?? 5;

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;

    const anterior = promoForm.precio_anterior ? Number(promoForm.precio_anterior) : null;
    const promocional = promoForm.precio_promocional ? Number(promoForm.precio_promocional) : null;
    if (anterior !== null && promocional !== null && promocional >= anterior) {
      avisar('El precio de la oferta tiene que ser menor que el precio anterior.', 'error');
      return;
    }

    setSavingPromo(true);
    try {
      await crearPromocion(comercio.id, {
        titulo: promoForm.titulo,
        descripcion: promoForm.descripcion,
        precio_anterior: anterior,
        precio_promocional: promocional,
        dias_vigencia: Number(promoForm.dias_vigencia),
      });
      setPromoForm(PROMO_VACIA);
      setIsModalOpen(false);
      avisar('Promoción publicada.', 'exito');
      await recargarPromociones(comercio.id);
    } catch (err) {
      avisar(`No se pudo publicar la promoción: ${mensajeError(err)}`, 'error');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = async (promo: Promocion) => {
    if (!comercio) return;
    const ok = await confirmar({
      titulo: 'Eliminar promoción',
      mensaje: `¿Eliminar "${promo.titulo}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligroso: true,
    });
    if (!ok) return;
    try {
      await eliminarPromocion(promo.id);
      await recargarPromociones(comercio.id);
      avisar('Promoción eliminada.', 'exito');
    } catch (err) {
      avisar(`No se pudo eliminar: ${mensajeError(err)}`, 'error');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-500 font-semibold">Cargando datos del comercio...</div>;
  }

  if (errorCarga) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center space-y-4">
        <p className="text-red-600 font-semibold">No pudimos cargar tu panel: {errorCarga}</p>
        <button onClick={() => void cargarDatos()} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold">
          Reintentar
        </button>
      </div>
    );
  }

  if (!comercio || comercio.eliminado_en) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center space-y-4">
        <Store className="w-12 h-12 mx-auto text-gray-300" aria-hidden="true" />
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {comercio?.eliminado_en ? (
            'Tu comercio fue dado de baja. Si es un error, comunicate con la administración.'
          ) : (
            <>
              Tu cuenta (<span className="font-semibold">{user?.email}</span>) todavía no tiene un comercio vinculado. Pedile al
              administrador que lo dé de alta con este email.
            </>
          )}
        </p>
        <button onClick={handleSignOut} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold">
          Cerrar sesión
        </button>
      </div>
    );
  }

  const motivo = motivoNoVisible(comercio);
  const suscripcion = comercio.suscripcion;
  const estadoSub = suscripcion ? ESTADO_SUSCRIPCION[suscripcion.estado] : null;

  // QR: con Place ID abre directamente el formulario de reseña de Google
  const urlResenias = comercio.google_place_id
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(comercio.google_place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${comercio.nombre}, ${comercio.direccion}, ${CIUDAD}, ${PROVINCIA}`,
      )}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(urlResenias)}`;

  const tarjetasMetricas = [
    { titulo: 'Visitas a la ficha', valor: metricas.visitas, Icono: Eye, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
    { titulo: 'Consultas por WhatsApp', valor: metricas.whatsapp, Icono: MessageCircle, color: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
    { titulo: 'Rutas "Cómo llegar"', valor: metricas.comoLlegar, Icono: Navigation, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* ENCABEZADO */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-100 border border-brand-100 dark:border-brand-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" aria-hidden="true" /> Panel del Comercio
              </span>
              {motivo ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" aria-hidden="true" /> No visible en el mapa: {motivo}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" aria-hidden="true" /> Visible en el mapa
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2 flex items-center gap-2">
              <Store className="w-7 h-7 text-brand-600" aria-hidden="true" />
              Panel de <span className="text-brand-600">{comercio.nombre}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to={`/comercio/${comercio.slug}`}
              target="_blank"
              className="flex-1 md:flex-none px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition"
            >
              Ver ficha pública <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* MÉTRICAS REALES */}
      <section aria-labelledby="titulo-metricas" className="space-y-2">
        <h2 id="titulo-metricas" className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Últimos 30 días
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tarjetasMetricas.map(({ titulo, valor, Icono, color }) => (
            <div
              key={titulo}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">{titulo}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{valor}</p>
              </div>
              <div className={`p-3 rounded-xl ${color}`}>
                <Icono className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DATOS + SUSCRIPCIÓN + QR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <Store className="w-5 h-5 text-brand-600" aria-hidden="true" /> Datos del comercio
            </h3>
            <dl className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <div><dt className="inline font-bold">Dirección: </dt><dd className="inline">{comercio.direccion || 'Sin cargar'}</dd></div>
              <div><dt className="inline font-bold">WhatsApp: </dt><dd className="inline">{comercio.whatsapp || 'Sin cargar'}</dd></div>
              <div className="line-clamp-2"><dt className="inline font-bold">Descripción: </dt><dd className="inline">{comercio.descripcion_corta || 'Sin descripción'}</dd></div>
            </dl>
          </div>
          <Link
            to="/panel/perfil"
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Edit className="w-4 h-4" aria-hidden="true" /> Editar datos y horarios
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" aria-hidden="true" /> Suscripción mensual
            </h3>
            {estadoSub ? (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${estadoSub.clase}`}>{estadoSub.texto}</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Sin suscripción</span>
            )}
          </div>

          {suscripcion ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <span className="text-gray-500">Monto mensual:</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(suscripcion.precio_acordado)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <span className="text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Próximo vencimiento:
                </span>
                <span className="font-bold text-brand-600">{formatDate(suscripcion.proximo_vencimiento)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Todavía no tenés una suscripción registrada. Comunicate con la administración.</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b dark:border-gray-700 pb-3">
              <QrCode className="w-5 h-5 text-brand-600" aria-hidden="true" /> QR para reseñas en Google
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              {comercio.google_place_id
                ? 'Tus clientes escanean el QR y van directo a dejar su reseña en Google.'
                : 'Hoy el QR abre tu comercio en Google Maps. Para que abra directo el formulario de reseña, cargá tu Place ID en "Editar datos".'}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 py-2">
            <img src={qrUrl} alt={`Código QR para reseñas de ${comercio.nombre}`} className="w-28 h-28 p-1 bg-white rounded-lg border shadow-sm" />
            <a href={qrUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-600 hover:underline">
              Abrir QR para imprimir
            </a>
          </div>
        </div>
      </div>

      {/* HORARIOS (solo lectura; se editan en "Editar datos y horarios") */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" aria-hidden="true" /> Horarios de atención
          </h3>
          <Link to="/panel/perfil" className="text-xs font-bold text-brand-600 hover:underline">
            Editar horarios
          </Link>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIAS_SEMANA.map((dia, idx) => {
            const turnosDia = horarios.filter((h) => h.dia_semana === idx).sort((a, b) => a.turno - b.turno);
            return (
              <div key={dia} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
                <dt className="font-bold text-xs text-gray-700 dark:text-gray-300">{dia}</dt>
                <dd className="text-[11px] font-mono text-gray-900 dark:text-white">
                  {turnosDia.length > 0
                    ? turnosDia.map((t) => `${formatHora(t.hora_apertura)} - ${formatHora(t.hora_cierre)}`).join(' / ')
                    : 'Cerrado'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* PROMOCIONES */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b dark:border-gray-700 pb-4">
          <div>
            <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-6 h-6 text-amber-500" aria-hidden="true" /> Mis promociones
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {promosActivas.length} de {limitePromos} promociones activas de tu plan.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={promosActivas.length >= limitePromos}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" /> Publicar promoción
          </button>
        </div>

        {promociones.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">No tenés promociones publicadas.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promociones.map((p) => {
              const vigente = estaVigente(p);
              return (
                <div key={p.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border space-y-2 relative">
                  <button
                    onClick={() => void handleDeletePromo(p)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-600"
                    aria-label={`Eliminar promoción ${p.titulo}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex flex-wrap gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${vigente ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {vigente ? `Vigente hasta ${formatDate(p.fecha_fin)}` : 'Vencida'}
                    </span>
                    {!p.aprobada && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Oculta por el admin</span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white pr-6">{p.titulo}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{p.descripcion}</p>
                  {p.precio_promocional && (
                    <div className="text-lg font-bold text-green-600">{formatCurrency(p.precio_promocional)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL NUEVA PROMOCIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-nueva-promo">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 id="titulo-nueva-promo" className="text-lg font-bold">
              Publicar nueva promoción
            </h3>
            <form onSubmit={handleCreatePromo} className="space-y-3">
              <div>
                <label htmlFor="promo-titulo" className="block text-xs font-semibold mb-1">Título</label>
                <input
                  id="promo-titulo"
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Ej: 2x1 en pizzas"
                  value={promoForm.titulo}
                  onChange={(e) => setPromoForm({ ...promoForm, titulo: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label htmlFor="promo-descripcion" className="block text-xs font-semibold mb-1">Descripción</label>
                <textarea
                  id="promo-descripcion"
                  required
                  maxLength={400}
                  placeholder="Detalles de la promoción..."
                  value={promoForm.descripcion}
                  onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="promo-anterior" className="block text-xs font-semibold mb-1">Precio anterior (opcional)</label>
                  <input
                    id="promo-anterior"
                    type="number"
                    min="0"
                    step="1"
                    value={promoForm.precio_anterior}
                    onChange={(e) => setPromoForm({ ...promoForm, precio_anterior: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="promo-precio" className="block text-xs font-semibold mb-1">Precio oferta (opcional)</label>
                  <input
                    id="promo-precio"
                    type="number"
                    min="0"
                    step="1"
                    value={promoForm.precio_promocional}
                    onChange={(e) => setPromoForm({ ...promoForm, precio_promocional: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="promo-vigencia" className="block text-xs font-semibold mb-1">Vigencia</label>
                <select
                  id="promo-vigencia"
                  value={promoForm.dias_vigencia}
                  onChange={(e) => setPromoForm({ ...promoForm, dias_vigencia: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="7">7 días</option>
                  <option value="15">15 días</option>
                  <option value="30">30 días</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPromo} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold">
                  {savingPromo ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
