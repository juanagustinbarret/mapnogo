import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CreditCard, Clock, LayoutDashboard, LogOut, PlusCircle, Settings, Shield, Tag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PESTANIAS = [
  { to: '/admin', label: 'Comercios', Icono: LayoutDashboard, end: true },
  { to: '/admin/pagos', label: 'Pagos', Icono: CreditCard },
  { to: '/admin/vencimientos', label: 'Vencimientos', Icono: Clock },
  { to: '/admin/promociones', label: 'Promociones', Icono: Tag },
  { to: '/admin/comercios/nuevo', label: 'Nuevo comercio', Icono: PlusCircle },
  { to: '/admin/configuracion', label: 'Configuración', Icono: Settings },
];

// Encabezado y navegación compartidos por todas las pantallas del admin
export const AdminLayout: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const cerrarSesion = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-brand-600" aria-hidden="true" /> Panel Administrador
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Comercios, cobranzas, vencimientos y avisos por WhatsApp.
            </p>
          </div>
          <button
            onClick={cerrarSesion}
            className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </div>

        <nav aria-label="Secciones del admin" className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
          {PESTANIAS.map(({ to, label, Icono, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`
              }
            >
              <Icono className="w-3.5 h-3.5" aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
};
