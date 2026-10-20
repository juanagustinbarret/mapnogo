import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminEventosModal } from '@/components/AdminEventosModal';
import {
  KeyRound,
  Mail,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  CreditCard,
  PlusCircle,
  LogOut,
  Search,
  RefreshCw,
  MessageCircle,
  Calendar,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface SolicitudRecuperacion {
  id: string;
  email: string;
  estado: 'pendiente' | 'resuelto' | 'cancelado';
  created_at: string;
}

export const AdminSolicitudesPasswordPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [solicitudes, setSolicitudes] = useState<SolicitudRecuperacion[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Estado para el modal de eventos
  const [modalEventosOpen, setModalEventosOpen] = useState(false);

  const cargarSolicitudes = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('solicitudes_recuperacion')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSolicitudes(data as SolicitudRecuperacion[]);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  // Genera un token único y seguro asociado al comercio por 15 minutos
  const generarTokenSeguro = async (email: string): Promise<string | null> => {
    // 1. Obtener el ID del comercio mediante su email
    const { data: comercio, error: errorComercio } = await supabase
      .from('comercios')
      .select('id')
      .eq('email_comercial', email)
      .maybeSingle();

    if (errorComercio || !comercio) {
      alert(`No se encontró un comercio registrado con el email ${email}`);
      return null;
    }

    // 2. Generar token aleatorio criptográfico seguro (32 bytes)
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');

    // 3. Insertar el token en la tabla tokens_recuperacion_password
    const { error: errorToken } = await supabase
      .from('tokens_recuperacion_password')
      .insert({
        comercio_id: comercio.id,
        token: token,
        expira_en: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
      });

    if (errorToken) {
      alert('Error al generar el token seguro: ' + errorToken.message);
      return null;
    }

    return token;
  };

  // Función unificada para generar token y enviar vía Mail o WhatsApp
  const handleGenerarYEnviar = async (solicitudId: string, emailTarget: string, canal: 'mail' | 'whatsapp') => {
    setProcesandoId(solicitudId);
    try {
      const token = await generarTokenSeguro(emailTarget);
      if (!token) return;

      const linkReset = `${window.location.origin}/reset-password?token=${token}`;
      const mensajeTexto = `Hola!\n\nRecibimos tu solicitud para restablecer la contraseña de tu comercio en NOGOMAP.\n\nPodés ingresar tu nueva contraseña haciendo clic en el siguiente enlace seguro (válido por 15 minutos):\n${linkReset}\n\nSi no solicitaste este cambio, podés ignorar este mensaje.\n\nSaludos,\nEquipo NOGOMAP`;

      // Copiar enlace al portapapeles por comodidad
      await navigator.clipboard.writeText(linkReset);

      if (canal === 'mail') {
        const asunto = encodeURIComponent('Restablecer contraseña - NOGOMAP');
        const cuerpo = encodeURIComponent(mensajeTexto);
        const urlGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTarget)}&su=${asunto}&body=${cuerpo}`;
        window.open(urlGmail, '_blank');
      } else {
        // Consultar si el comercio tiene WhatsApp registrado
        const { data: comercio } = await supabase
          .from('comercios')
          .select('whatsapp')
          .eq('email_comercial', emailTarget)
          .maybeSingle();

        const numWhatsApp = comercio?.whatsapp ? comercio.whatsapp.replace(/\D/g, '') : '';
        const urlWhatsApp = numWhatsApp
          ? `https://wa.me/${numWhatsApp}?text=${encodeURIComponent(mensajeTexto)}`
          : `https://wa.me/?text=${encodeURIComponent(mensajeTexto)}`;

        window.open(urlWhatsApp, '_blank');
      }

      // Marcar solicitud como resuelta
      await supabase
        .from('solicitudes_recuperacion')
        .update({ estado: 'resuelto' })
        .eq('id', solicitudId);

      await cargarSolicitudes();
      alert(`✅ Token generado y mensaje abierto en ${canal === 'mail' ? 'Gmail' : 'WhatsApp'} (Enlace copiado al portapapeles).`);
    } catch (err: any) {
      console.error('Error procesando la solicitud:', err);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleMarcarResuelto = async (solicitudId: string) => {
    setProcesandoId(solicitudId);
    try {
      const { error } = await supabase
        .from('solicitudes_recuperacion')
        .update({ estado: 'resuelto' })
        .eq('id', solicitudId);

      if (error) throw error;
      await cargarSolicitudes();
    } catch (err: any) {
      alert('Error al actualizar la solicitud: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const filtradas = solicitudes.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const pendientesCount = solicitudes.filter((s) => s.estado === 'pendiente').length;

  const rutaActiva = (ruta: string) =>
    location.pathname === ruta
      ? 'bg-amber-600 text-white shadow-sm'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      {/* HEADER PRINCIPAL Y BARRA DE NAVEGACIÓN */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-7 h-7 text-amber-500" /> Solicitud Cambio de Contraseña
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gestión de solicitudes de blanqueo de clave recibidas de los comercios en NOGOMAP.
            </p>
          </div>

          <button
            onClick={() => {
              signOut();
              navigate('/admin/login');
            }}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>

        {/* NAVEGACIÓN COMPLETA UNIFICADA */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border-t dark:border-gray-700 pt-4">
          <Link
            to="/admin"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
              location.pathname === '/admin'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link
            to="/admin/pagos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
              location.pathname === '/admin/pagos'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Pagos
          </Link>
          <Link
            to="/admin/vencimientos"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
              location.pathname === '/admin/vencimientos'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
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
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${rutaActiva(
              '/admin/solicitudes-password'
            )}`}
          >
            <KeyRound className="w-4 h-4" /> Solicitudes{' '}
            {pendientesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px]">
                {pendientesCount}
              </span>
            )}
          </Link>
          <Link
            to="/admin/comercios/nuevo"
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
              location.pathname === '/admin/comercios/nuevo'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Alta Comercio
          </Link>
        </div>
      </div>

      {/* PANEL DE SOLICITUDES */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            onClick={cargarSolicitudes}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar Lista
          </button>
        </div>

        {cargando ? (
          <p className="text-xs text-gray-500 py-8 text-center">Cargando solicitudes...</p>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <KeyRound className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
            <p className="text-sm font-semibold">No hay solicitudes registradas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map((sol) => (
              <div
                key={sol.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  sol.estado === 'pendiente'
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      sol.estado === 'pendiente'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{sol.email}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(sol.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sol.estado === 'pendiente' ? (
                    <>
                      <button
                        onClick={() => handleGenerarYEnviar(sol.id, sol.email, 'mail')}
                        disabled={procesandoId === sol.id}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Enviar link seguro por mail"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Enviar Mail
                      </button>

                      <button
                        onClick={() => handleGenerarYEnviar(sol.id, sol.email, 'whatsapp')}
                        disabled={procesandoId === sol.id}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Enviar link seguro por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar WhatsApp
                      </button>

                      <button
                        onClick={() => handleMarcarResuelto(sol.id)}
                        disabled={procesandoId === sol.id}
                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        Marcar Resuelto
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 rounded-full text-xs font-bold">
                      ✓ Resuelto
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE GESTIÓN DE EVENTOS Y ANUNCIOS */}
      <AdminEventosModal isOpen={modalEventosOpen} onClose={() => setModalEventosOpen(false)} />
    </div>
  );
};
