import React, { useEffect, useState } from 'react';
import { ModalMetricasWhatsApp } from '@/components/ModalMetricasWhatsApp';
import { AdminEventosModal } from '@/components/AdminEventosModal';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { formatDate } from '@/lib/formatters';
import {
  PLANTILLAS_PREDETERMINADAS,
  armarRecordatorio,
  leerPlantillasGuardadas,
  type ResultadoRecordatorio,
  type TipoPlantilla,
} from '@/lib/plantillasMensajes';
import { EditorMensajeWhatsApp } from '@/components/EditorMensajeWhatsApp';
import {
  MessageCircle,
  Clock,
  Search,
  ExternalLink,
  BarChart2,
  LayoutDashboard,
  CreditCard,
  PlusCircle,
  LogOut,
  AlertTriangle,
  Calendar,
  KeyRound
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface SuscripcionResumen {
  comercio_id: string;
  precio_acordado: number | null;
  proximo_vencimiento: string | null;
  estado: string;
  plan_id?: string | null;
}

export const AdminExpirationsPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  const [plantillas, setPlantillas] = useState<Record<TipoPlantilla, string>>(PLANTILLAS_PREDETERMINADAS);
  const [suscripciones, setSuscripciones] = useState<Record<string, SuscripcionResumen>>({});
  const [planes, setPlanes] = useState<Record<string, string>>({});
  const [comercioMetricas, setComercioMetricas] = useState<Comercio | null>(null);
  const [recordatorio, setRecordatorio] = useState<{ comercio: Comercio; resultado: Extract<ResultadoRecordatorio, { ok: true }> } | null>(null);
  const [modalEventosOpen, setModalEventosOpen] = useState(false);

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    const [{ data }, { data: subs }, { data: config }, { data: listaPlanes }] = await Promise.all([
      supabase.from('comercios').select('*').order('nombre'),
      supabase.from('suscripciones').select('comercio_id, precio_acordado, proximo_vencimiento, estado, plan_id'),
      supabase.from('configuracion_sistema').select('valor').eq('clave', 'plantillas_whatsapp').maybeSingle(),
      supabase.from('planes').select('id, nombre'),
    ]);
    if (listaPlanes) setPlanes(Object.fromEntries(listaPlanes.map((pl) => [pl.id, pl.nombre])));
    if (data) setComercios(data);
    if (subs) {
      const porComercio: Record<string, SuscripcionResumen> = {};
      subs.forEach((sub) => {
        porComercio[sub.comercio_id] = sub as SuscripcionResumen;
      });
      setSuscripciones(porComercio);
    }
    setPlantillas(leerPlantillasGuardadas(config?.valor));
  };

  const handleEnviarWhatsApp = (comercio: Comercio) => {
    const sub = suscripciones[comercio.id];
    const resultado = armarRecordatorio(
      {
        nombre: comercio.nombre,
        whatsappValido: normalizeWhatsAppNumber(comercio.whatsapp).isValid,
        suscripcion: sub ? { ...sub, plan: sub.plan_id ? planes[sub.plan_id] : null } : null,
      },
      plantillas,
      { linkPanel: `${window.location.origin}/panel` },
    );
    if (!resultado.ok) {
      alert(`⚠️ ${resultado.mensajeError}`);
      return;
    }
    setRecordatorio({ comercio, resultado });
  };

  const handleEnviarMetricasWhatsApp = (comercio: Comercio) => {
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);
    if (!numInfo.isValid) {
      alert(`⚠️ El comercio "${comercio.nombre}" no tiene un número de WhatsApp válido cargado.`);
      return;
    }
    setComercioMetricas(comercio);
  };

  const filtrados = comercios.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.whatsapp && c.whatsapp.includes(search))
  );

  const rutaActiva = (ruta: string) =>
    location.pathname === ruta
      ? 'bg-amber-600 text-white shadow-sm'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-7 h-7 text-amber-500" /> Control de Vencimientos & WhatsApp
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Notificaciones directas por WhatsApp con recordatorios configurables y avisos de cobro.
            </p>
          </div>

          <button
            onClick={() => { signOut(); navigate('/admin/login'); }}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

        {/* NAVEGACIÓN COMPLETA UNIFICADA DE 6 OPCIONES */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/admin"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${location.pathname === '/admin' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>

          <Link
            to="/admin/pagos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${location.pathname === '/admin/pagos' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <CreditCard className="w-4 h-4" /> Pagos
          </Link>

          <Link
            to="/admin/vencimientos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva('/admin/vencimientos')}`}
          >
            <Clock className="w-4 h-4" /> Vencimientos
          </Link>

          <button
            type="button"
            onClick={() => setModalEventosOpen(true)}
            className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm"
          >
            <Calendar className="w-4 h-4" /> Eventos
          </button>

          <Link
            to="/admin/solicitudes-password"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${location.pathname === '/admin/solicitudes-password' ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <KeyRound className="w-4 h-4" /> Solicitudes
          </Link>

          <Link
            to="/admin/comercios/nuevo"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${location.pathname === '/admin/comercios/nuevo' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <PlusCircle className="w-4 h-4" /> Alta Comercio
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-xs text-gray-600 dark:text-gray-300 space-y-1">
        <p>
          Los mensajes salen de las plantillas de{' '}
          <Link to="/admin/configuracion" className="font-bold text-brand-600 hover:underline">Configuración → Mensajes de WhatsApp</Link>.
          Antes de abrir WhatsApp podés editar cada uno.
        </p>
        <p className="text-gray-500">
          Con suscripción: recordatorio de pago. Sin suscripción: invitación a activarla (sin importe). Sin WhatsApp válido: no se puede enviar.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por comercio o WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtrados.map((c) => {
              const tieneWhatsApp = normalizeWhatsAppNumber(c.whatsapp).isValid;
              const tieneSuscripcion = Boolean(suscripciones[c.id]);
              return (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{c.nombre}</h4>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tieneWhatsApp ? c.whatsapp : '⚠️ No cargado'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {suscripciones[c.id]?.proximo_vencimiento
                        ? `Vence: ${formatDate(suscripciones[c.id].proximo_vencimiento as string)}`
                        : 'Sin suscripción cargada'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t dark:border-gray-800">
                    <button
                      disabled={!tieneWhatsApp}
                      title={tieneWhatsApp ? undefined : 'El comercio no tiene un WhatsApp válido cargado'}
                      onClick={() => handleEnviarMetricasWhatsApp(c)}
                      className="w-full py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                    </button>

                    <button
                      disabled={!tieneWhatsApp}
                      title={tieneWhatsApp ? undefined : 'El comercio no tiene un WhatsApp válido cargado'}
                      onClick={() => handleEnviarWhatsApp(c)}
                      className="w-full py-2 bg-green-600 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="w-4 h-4" /> {tieneSuscripcion ? 'Recordatorio' : 'Invitar a suscribirse'} <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  {!tieneWhatsApp && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Sin WhatsApp válido: cargalo en la edición del comercio para poder enviarle mensajes.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3.5 w-[35%]">Comercio</th>
                  <th className="p-3.5 w-[30%]">WhatsApp Registrado</th>
                  <th className="p-3.5 w-[35%] text-right">Acción Directa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                {filtrados.map((c) => {
                  const tieneWhatsApp = normalizeWhatsAppNumber(c.whatsapp).isValid;
                  const tieneSuscripcion = Boolean(suscripciones[c.id]);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white truncate">
                        {c.nombre}
                        <span className="block text-[11px] font-normal text-gray-500">
                          {suscripciones[c.id]?.proximo_vencimiento
                            ? `Vence: ${formatDate(suscripciones[c.id].proximo_vencimiento as string)}`
                            : 'Sin suscripción cargada'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-gray-600 dark:text-gray-300 truncate">
                        {tieneWhatsApp ? (
                          c.whatsapp
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> No cargado
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          disabled={!tieneWhatsApp}
                          title={tieneWhatsApp ? undefined : 'El comercio no tiene un WhatsApp válido cargado'}
                          onClick={() => handleEnviarMetricasWhatsApp(c)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                        </button>

                        <button
                          disabled={!tieneWhatsApp}
                          title={tieneWhatsApp ? undefined : 'El comercio no tiene un WhatsApp válido cargado'}
                          onClick={() => handleEnviarWhatsApp(c)}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageCircle className="w-4 h-4" /> {tieneSuscripcion ? 'Enviar Recordatorio' : 'Invitar a suscribirse'} <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {comercioMetricas && (
        <ModalMetricasWhatsApp
          comercio={comercioMetricas}
          plantilla={plantillas.metricas}
          onCerrar={() => setComercioMetricas(null)}
        />
      )}

      {recordatorio && (
        <EditorMensajeWhatsApp
          titulo={
            recordatorio.resultado.tipo === 'recordatorio_pago'
              ? `Recordatorio para ${recordatorio.comercio.nombre}`
              : `Invitación a suscribirse para ${recordatorio.comercio.nombre}`
          }
          tipo={recordatorio.resultado.tipo}
          textoInicial={recordatorio.resultado.texto}
          valores={recordatorio.resultado.valores}
          telefono={normalizeWhatsAppNumber(recordatorio.comercio.whatsapp).normalized}
          aviso={recordatorio.resultado.aviso}
          onCerrar={() => setRecordatorio(null)}
        />
      )}

      <AdminEventosModal
        isOpen={modalEventosOpen}
        onClose={() => setModalEventosOpen(false)}
      />
    </div>
  );
};