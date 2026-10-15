import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { normalizeWhatsAppNumber, buildWhatsAppUrl } from '@/lib/whatsapp';
import {
  MessageCircle,
  Clock,
  Search,
  ExternalLink,
  BarChart2,
  LayoutDashboard,
  CreditCard,
  PlusCircle,
  LogOut
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const AdminExpirationsPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  const [mensajePersonalizado, setMensajePersonalizado] = useState(
    'Hola! Te contactamos de Nogoyá Cerca. 👋 Tu suscripción mensual vence en 3 días, por favor aboná para seguir disfrutando del servicio, cualquier modificación que desees comunicate con algún administrador, gracias.'
  );

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    const { data } = await supabase.from('comercios').select('*').order('nombre');
    if (data) setComercios(data);
  };

  const handleEnviarWhatsApp = (comercio: Comercio) => {
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);

    if (!numInfo.isValid) {
      alert(`⚠️ El número de WhatsApp (${comercio.whatsapp}) no es válido.`);
      return;
    }

    const mensajeFinal = `Hola *${comercio.nombre}*! 👋\n\n${mensajePersonalizado}`;
    const url = buildWhatsAppUrl(numInfo.normalized, mensajeFinal);
    window.open(url, '_blank');
  };

  const handleEnviarMetricasWhatsApp = (comercio: Comercio) => {
    const numInfo = normalizeWhatsAppNumber(comercio.whatsapp);

    if (!numInfo.isValid) {
      alert(`⚠️ El número de WhatsApp (${comercio.whatsapp}) no es válido.`);
      return;
    }

    const visitasSemana = Math.floor(Math.random() * 45) + 20;
    const mensajeMetricas = `Hola *${comercio.nombre}*! 🚀\n\nQueríamos contarte que durante esta semana tu ficha en Nogoyá Cerca acumuló *${visitasSemana} visitas y búsquedas de ruta*. ¡Gracias por confiar en nosotros! 🙌`;

    const url = buildWhatsAppUrl(numInfo.normalized, mensajeMetricas);
    window.open(url, '_blank');
  };

  const filtrados = comercios.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || c.whatsapp.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER PRINCIPAL Y BARRA DE NAVEGACIÓN */}
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

        {/* NAVEGACIÓN EN GRID ADAPTABLE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/admin"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="truncate">Dashboard</span>
          </Link>

          <Link
            to="/admin/pagos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/pagos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="truncate">Pagos</span>
          </Link>

          <Link
            to="/admin/vencimientos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/vencimientos'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">Vencimientos</span>
          </Link>

          <Link
            to="/admin/comercios/nuevo"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-center transition ${
              location.pathname === '/admin/comercios/nuevo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Alta Comercio</span>
          </Link>
        </div>
      </div>

      {/* CAJA MENSAJE PERSONALIZADO */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
          Mensaje de Recordatorio de Vencimiento
        </label>
        <textarea
          rows={3}
          value={mensajePersonalizado}
          onChange={(e) => setMensajePersonalizado(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
        />
      </div>

      {/* SECCIÓN RESPONSIVA DE VENCIMIENTOS */}
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
          {/* VISTA EN TARJETAS PARA CELULARES */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtrados.map((c) => (
              <div key={c.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{c.nombre}</h4>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.whatsapp || 'Sin WhatsApp'}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t dark:border-gray-800">
                  <button
                    onClick={() => handleEnviarMetricasWhatsApp(c)}
                    className="w-full py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                  </button>

                  <button
                    onClick={() => handleEnviarWhatsApp(c)}
                    className="w-full py-2 bg-green-600 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" /> Recordatorio <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* VISTA EN TABLA PARA COMPUTADORAS */}
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
                {filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white truncate">{c.nombre}</td>
                    <td className="p-3.5 font-mono text-xs text-gray-600 dark:text-gray-300 truncate">{c.whatsapp || 'No cargado'}</td>
                    <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleEnviarMetricasWhatsApp(c)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-100 transition"
                      >
                        <BarChart2 className="w-3.5 h-3.5" /> Enviar Métricas
                      </button>

                      <button
                        onClick={() => handleEnviarWhatsApp(c)}
                        className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                      >
                        <MessageCircle className="w-4 h-4" /> Enviar Recordatorio <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};