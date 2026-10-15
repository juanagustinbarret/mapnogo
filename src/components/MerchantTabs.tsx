import React from 'react';
import { NavLink } from 'react-router-dom';
import { Edit, LayoutDashboard } from 'lucide-react';

const PESTANIAS = [
  { to: '/panel', label: 'Dashboard', Icono: LayoutDashboard },
  { to: '/panel/perfil', label: 'Editar datos y horarios', Icono: Edit },
];

// Pestañas compartidas por las pantallas del panel del comercio
export const MerchantTabs: React.FC = () => (
  <nav aria-label="Secciones del panel" className="flex items-center gap-2 overflow-x-auto">
    {PESTANIAS.map(({ to, label, Icono }) => (
      <NavLink
        key={to}
        to={to}
        end
        className={({ isActive }) =>
          `px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition ${
            isActive
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`
        }
      >
        <Icono className="w-4 h-4" aria-hidden="true" /> {label}
      </NavLink>
    ))}
  </nav>
);
