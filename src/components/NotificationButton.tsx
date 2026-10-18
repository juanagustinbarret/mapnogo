import { useState } from 'react';
import { mensajeFalloPush, solicitarPermisoNotificacionesPush } from '@/lib/pushNotifications';

export function NotificationButton() {
  const [activado, setActivado] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleActivar = async () => {
    setCargando(true);
    const resultado = await solicitarPermisoNotificacionesPush();
    setCargando(false);

    if (resultado.ok) {
      setActivado(true);
      alert('¡Notificaciones activadas con éxito!');
    } else {
      alert(mensajeFalloPush(resultado));
    }
  };

  return (
    <button
      onClick={handleActivar}
      disabled={cargando || activado}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
    >
      🔔 {activado ? 'Notificaciones Activadas' : cargando ? 'Activando...' : 'Activar Notificaciones'}
    </button>
  );
}