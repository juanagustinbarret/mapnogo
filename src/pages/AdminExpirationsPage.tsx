import React, { useEffect, useState } from 'react';
import { ModalMetricasWhatsApp } from '@/components/ModalMetricasWhatsApp';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { normalizeWhatsAppNumber, buildWhatsAppUrl, compileTemplate, variablesSinCompletar } from '@/lib/whatsapp';
import { formatCurrency, formatDate } from '@/lib/formatters';
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
  AlertTriangle
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface SuscripcionResumen {
  comercio_id: string;
  precio_acordado: number;
  proximo_vencimiento: string | null;
  estado: string;
}

const PLANTILLA_POR_DEFECTO =
  'Hola, ¿cómo estás? 👋\nTe recordamos que el [VENCIMIENTO] vence la suscripción mensual de [NOMBRE DEL COMERCIO] a NOGOMAP, por un importe de [IMPORTE].\nCuando realices el pago, avisanos para que podamos registrarlo. ¡Gracias!';

export const AdminExpirationsPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  // El mensaje sale de la plantilla "Próximo vencimiento" de Configuración.
  // Antes decía "vence en 3 días" para todos, sin importar la fecha real.
  const [mensajePersonalizado, setMensajePersonalizado] = useState(PLANTILLA_POR_DEFECTO);
  const [suscripciones, setSuscripciones] = useState<Record<string, SuscripcionResumen>>({});
  const [comercioMetricas, setComercioMetricas] = useState<Comercio | null>(null);

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    const [{ data }, { data: subs }, { data: config }] = await Promise.all([
      supabase.from('comercios').select('*').order('nombre'),
      supabase.from('suscripciones').select('comercio_id, precio_acordado, proximo_vencimiento, estado'),
      supabase.from('configuracion_sistema').select('valor').eq('clave', 'plantillas_whatsapp').maybeSingle(),
    ]);
    if (data) setComercios(data);
    if (subs) {
      const porComercio: Record<string, SuscripcionResumen> = {};
      subs.forEach((sub) => {
        porComercio[sub.comercio_id] = sub as SuscripcionResumen;
      });
      setSuscripciones(porComercio);
    }
    const plantilla = (config?.valor as { proximo_vencimiento?: string } | undefined)?.proximo_vencimiento;
    if (plantilla?.trim()) setMensajePersonalizado(plantilla);
  };

  const handleEnviarWhatsApp = (comercio: Comercio) => {
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);

    if (!numInfo.isValid) {
      alert(`⚠️ El comercio "${comercio.nombre}" no tiene un número de WhatsApp válido cargado.`);
      return;
    }

    const sub = suscripciones[comercio.id];
    const mensajeFinal = compileTemplate(mensajePersonalizado, {
      nombreComercio: comercio.nombre,
      importe: sub ? formatCurrency(Number(sub.precio_acordado)) : undefined,
      vencimiento: sub?.proximo_vencimiento ? formatDate(sub.proximo_vencimiento) : undefined,
      periodoFacturado: sub?.proximo_vencimiento ? formatDate(sub.proximo_vencimiento).slice(3) : undefined,
    });

    // No mandar un mensaje con huecos como "[IMPORTE]" al cliente
    const faltantes = variablesSinCompletar(mensajeFinal);
    if (faltantes.length > 0) {
      alert(
        `⚠️ No se puede armar el mensaje para "${comercio.nombre}": faltan datos para ${faltantes.join(', ')}.` +
          (sub ? '' : ' El comercio no tiene una suscripción cargada.')
      );
      return;
    }

    const conSaludo = mensajePersonalizado.includes('[NOMBRE DEL COMERCIO]')
      ? mensajeFinal
      : `Hola *${comercio.nombre}*! 👋\n\n${mensajeFinal}`;
    window.open(buildWhatsAppUrl(numInfo.normalized, conSaludo), '_blank');
  };

  // Antes armaba el mensaje con los últimos 7 días fijos y lo abría directo.
  // Ahora se elige el período y se ve una vista previa (ModalMetricasWhatsApp).
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/admin"
            className="px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="truncate">Dashboard</span>
          </Link>

          <Link
            to="/admin/pagos"
            className="px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="truncate">Pagos</span>
          </Link>

          <Link
            to="/admin/vencimientos"
            className="px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center bg-amber-600 text-white shadow-sm"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">Vencimientos</span>
          </Link>

          <Link
            to="/admin/comercios/nuevo"
            className="px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Alta Comercio</span>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
          Mensaje de Recordatorio de Vencimiento
        </label>
        <p className="text-[11px] text-gray-500">
          Se carga desde Configuración → plantilla "Próximo vencimiento". Variables: [NOMBRE DEL COMERCIO], [IMPORTE], [VENCIMIENTO], [PERIODO].
        </p>
        <textarea
          rows={4}
          value={mensajePersonalizado}
          onChange={(e) => setMensajePersonalizado(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
        />
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
              const tieneWhatsApp = Boolean(c.whatsapp && c.whatsapp.trim().length > 0);
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
                      onClick={() => handleEnviarMetricasWhatsApp(c)}
                      className="w-full py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                    </button>

                    <button
                      disabled={!tieneWhatsApp}
                      onClick={() => handleEnviarWhatsApp(c)}
                      className="w-full py-2 bg-green-600 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="w-4 h-4" /> Recordatorio <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
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
                  const tieneWhatsApp = Boolean(c.whatsapp && c.whatsapp.trim().length > 0);
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
                          onClick={() => handleEnviarMetricasWhatsApp(c)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                        </button>

                        <button
                          disabled={!tieneWhatsApp}
                          onClick={() => handleEnviarWhatsApp(c)}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageCircle className="w-4 h-4" /> Enviar Recordatorio <ExternalLink className="w-3 h-3" />
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
        <ModalMetricasWhatsApp comercio={comercioMetricas} onCerrar={() => setComercioMetricas(null)} />
      )}
    </div>
  );
};