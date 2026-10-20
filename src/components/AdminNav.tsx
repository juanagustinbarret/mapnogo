import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Clock, CreditCard, KeyRound, LayoutDashboard, PlusCircle, type LucideIcon } from 'lucide-react';
import { AdminEventosModal } from '@/components/AdminEventosModal';

// Pestañas del panel de administración. Antes estaban copiadas en cada página
// y no coincidían: en Pagos faltaban "Eventos" y "Solicitudes".
const PESTANAS: Array<{ ruta: string; texto: string; Icono: LucideIcon; activa: string }> = [
  { ruta: '/admin', texto: 'Dashboard', Icono: LayoutDashboard, activa: 'bg-brand-600' },
  { ruta: '/admin/pagos', texto: 'Pagos', Icono: CreditCard, activa: 'bg-blue-600' },
  { ruta: '/admin/vencimientos', texto: 'Vencimientos', Icono: Clock, activa: 'bg-amber-600' },
  { ruta: '/admin/solicitudes-password', texto: 'Solicitudes', Icono: KeyRound, activa: 'bg-amber-600' },
  { ruta: '/admin/comercios/nuevo', texto: 'Alta comercio', Icono: PlusCircle, activa: 'bg-emerald-600' },
];

const BASE = 'px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition min-w-0';
const INACTIVA = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';

export const AdminNav: React.FC = () => {
  const { pathname } = useLocation();
  const [eventosAbierto, setEventosAbierto] = useState(false);

  const pestana = ({ ruta, texto, Icono, activa }: (typeof PESTANAS)[number]) => {
    const esActual = pathname === ruta;
    return (
      <Link
        key={ruta}
        to={ruta}
        aria-current={esActual ? 'page' : undefined}
        className={`${BASE} ${esActual ? `${activa} text-white shadow-sm` : INACTIVA}`}
      >
        <Icono className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{texto}</span>
      </Link>
    );
  };

  return (
    <>
      <nav aria-label="Secciones del panel de administración" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 border-t dark:border-gray-700 pt-4">
        {PESTANAS.slice(0, 3).map(pestana)}
        <button
          type="button"
          onClick={() => setEventosAbierto(true)}
          className={`${BASE} bg-amber-500 hover:bg-amber-600 text-white shadow-sm`}
        >
          <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Eventos</span>
        </button>
        {PESTANAS.slice(3).map(pestana)}
      </nav>
      <AdminEventosModal isOpen={eventosAbierto} onClose={() => setEventosAbierto(false)} />
    </>
  );
};
