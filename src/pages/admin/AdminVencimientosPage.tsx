import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio, Suscripcion } from '@/types/database.types';
import { formatDate, formatCurrency } from '@/lib/formatters';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Search,
  RefreshCw,
  Calendar,
  Building,
  DollarSign,
} from 'lucide-react';

interface ComercioSuscripcion extends Comercio {
  suscripcion?: Suscripcion | null;
  diasParaVencer?: number;
}

export const AdminVencimientosPage: React.FC = () => {
  const [comercios, setComercios] = useState<ComercioSuscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'vencidos' | 'por_vencer' | 'al_dia'>('todos');
  const [search, setSearch] = useState('');

  const fetchVencimientos = async () => {
    setLoading(true);
    try {
      const { data: listComercios, error: errC } = await supabase
        .from('comercios')
        .select('*')
        .order('nombre', { ascending: true });

      if (errC) throw errC;

      const { data: listSuscripciones, error: errS } = await supabase
        .from('suscripciones')
        .select('*');

      if (errS) throw errS;

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const combinados: ComercioSuscripcion[] = (listComercios || []).map((c) => {
        const sub = listSuscripciones?.find((s) => s.comercio_id === c.id) || null;
        let dias = 999;

        if (sub?.proximo_vencimiento) {
          const venc = new Date(sub.proximo_vencimiento);
          venc.setHours(0, 0, 0, 0);
          const diffTime = venc.getTime() - hoy.getTime();
          dias = Math.ceil(diffTime / (1000 * 3600 * 24));
        }

        return {
          ...c,
          suscripcion: sub,
          diasParaVencer: dias,
        };
      });

      setComercios(combinados);
    } catch (err: any) {
      alert('Error al cargar vencimientos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVencimientos();
  }, []);

  const handleRenovarMes = async (comercio: ComercioSuscripcion) => {
    if (!comercio.suscripcion) {
      alert('Este comercio no tiene un registro de suscripción asignado.');
      return;
    }

    if (!confirm(`¿Confirmás el pago y la renovación por 30 días más para "${comercio.nombre}"?`)) return;

    try {
      const hoy = new Date();
      const nuevaFechaVenc = new Date();
      nuevaFechaVenc.setDate(hoy.getDate() + 30);

      const { error: errSub } = await supabase
        .from('suscripciones')
        .update({
          proximo_vencimiento: nuevaFechaVenc.toISOString().split('T')[0],
          estado: 'activa',
          ultimo_pago: hoy.toISOString().split('T')[0],
        })
        .eq('id', comercio.suscripcion.id);

      if (errSub) throw errSub;

      // Habilitar el comercio automáticamente si estaba oculto
      await supabase
        .from('comercios')
        .update({ habilitado_admin: true })
        .eq('id', comercio.id);

      alert(`✅ Suscripción de ${comercio.nombre} renovada hasta el ${formatDate(nuevaFechaVenc.toISOString())}`);
      fetchVencimientos();
    } catch (err: any) {
      alert('Error al renovar suscripción: ' + err.message);
    }
  };

  const generarLinkWhatsApp = (c: ComercioSuscripcion) => {
    if (!c.whatsapp) return '#';

    let tel = c.whatsapp.replace(/\D/g, '');
    if (!tel.startsWith('549') && !tel.startsWith('54')) {
      tel = `549${tel}`;
    }

    const estadoTexto =
      c.diasParaVencer! < 0
        ? `venció el ${formatDate(c.suscripcion?.proximo_vencimiento || '')}`
        : c.diasParaVencer === 0
        ? 'vence hoy'
        : `vence en ${c.diasParaVencer} días (${formatDate(c.suscripcion?.proximo_vencimiento || '')})`;

    const montoTexto = c.suscripcion?.precio_acordado
      ? formatCurrency(c.suscripcion.precio_acordado)
      : '$10.000';

    const mensaje = encodeURIComponent(
      `Hola! Te escribimos de NOGOMAP para recordarte que la cuota de tu comercio *${c.nombre}* ${estadoTexto}.\n\n` +
      `Monto a abonar: *${montoTexto}*\n\n` +
      `Podés transferir al alias del servicio y enviarnos el comprobante por este medio para mantener la visibilidad activa en la plataforma. ¡Muchas gracias!`
    );

    return `https://wa.me/${tel}?text=${mensaje}`;
  };

  const comerciosFiltrados = comercios.filter((c) => {
    const cumpleBusqueda =
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp?.includes(search);

    if (!cumpleBusqueda) return false;

    if (filtro === 'vencidos') return (c.diasParaVencer ?? 999) < 0;
    if (filtro === 'por_vencer') return (c.diasParaVencer ?? 999) >= 0 && (c.diasParaVencer ?? 999) <= 5;
    if (filtro === 'al_dia') return (c.diasParaVencer ?? 999) > 5;

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-600" /> Control de Vencimientos y Cobranzas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Revisá los estados de cuotas, cobrá o enviá recordatorios de pago por WhatsApp.
          </p>
        </div>

        <button
          onClick={fetchVencimientos}
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 transition"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              filtro === 'todos' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700'
            }`}
          >
            Todos ({comercios.length})
          </button>
          <button
            onClick={() => setFiltro('vencidos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              filtro === 'vencidos' ? 'bg-red-600 text-white' : 'bg-white dark:bg-gray-800 text-red-600 border dark:border-gray-700'
            }`}
          >
            Vencidos ({comercios.filter((c) => (c.diasParaVencer ?? 999) < 0).length})
          </button>
          <button
            onClick={() => setFiltro('por_vencer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              filtro === 'por_vencer' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-amber-600 border dark:border-gray-700'
            }`}
          >
            Por Vencer (≤ 5 días) ({comercios.filter((c) => (c.diasParaVencer ?? 999) >= 0 && (c.diasParaVencer ?? 999) <= 5).length})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* LISTADO DE COBRANZAS */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-bold">Cargando cobranzas...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {comerciosFiltrados.map((c) => {
            const dias = c.diasParaVencer ?? 999;
            const esVencido = dias < 0;
            const esPorVencer = dias >= 0 && dias <= 5;

            return (
              <div
                key={c.id}
                className={`p-4 sm:p-5 rounded-2xl border bg-white dark:bg-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-sm ${
                  esVencido
                    ? 'border-red-300 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10'
                    : esPorVencer
                    ? 'border-amber-300 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{c.nombre}</h3>
                    {esVencido ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Vencido ({Math.abs(dias)} días)
                      </span>
                    ) : esPorVencer ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Vence en {dias} {dias === 1 ? 'día' : 'días'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Al día
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <span><strong>Vencimiento:</strong> {c.suscripcion?.proximo_vencimiento ? formatDate(c.suscripcion.proximo_vencimiento) : 'Sin fecha'}</span>
                    <span>•</span>
                    <span><strong>Monto:</strong> {formatCurrency(c.suscripcion?.precio_acordado || 10000)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={generarLinkWhatsApp(c)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar Aviso WhatsApp
                  </a>

                  <button
                    onClick={() => handleRenovarMes(c)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Registrar Pago (+30 días)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};