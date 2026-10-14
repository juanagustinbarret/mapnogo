import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DollarSign, CheckCircle } from 'lucide-react';

export const AdminPaymentsPage: React.FC = () => {
  const [suscripciones, setSuscripciones] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSuscripciones();
  }, []);

  const fetchSuscripciones = async () => {
    const { data } = await supabase
      .from('suscripciones')
      .select('*, comercio:comercios(nombre)');
    if (data) setSuscripciones(data);
  };

  const registrarPago = async (suscripcionId: string, importe: number) => {
    setLoadingId(suscripcionId);
    const user = (await supabase.auth.getUser()).data.user;

    // 1. Obtener o crear período
    const periodoFacturado = new Date().toISOString().slice(0, 7);

    const { data: periodo } = await supabase
      .from('periodos_suscripcion')
      .upsert({
        suscripcion_id: suscripcionId,
        periodo_facturado: periodoFacturado,
        importe,
        vencimiento: new Date().toISOString().split('T')[0],
        estado_pago: 'pagado',
        fecha_pago: new Date().toISOString(),
      })
      .select()
      .single();

    if (periodo && user) {
      // 2. Registrar el pago
      await supabase.from('pagos').insert({
        periodo_suscripcion_id: periodo.id,
        importe,
        metodo_pago: 'transferencia',
        registrado_por: user.id,
      });

      // 3. Extender vencimiento al 10 del mes siguiente y marcar activa
      const proximo = new Date();
      proximo.setMonth(proximo.getMonth() + 1);
      proximo.setDate(10);

      await supabase
        .from('suscripciones')
        .update({
          estado: 'activa',
          proximo_vencimiento: proximo.toISOString().split('T')[0],
        })
        .eq('id', suscripcionId);

      await fetchSuscripciones();
    }
    setLoadingId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-green-600" /> Registro y Control de Pagos Mensuales
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs font-bold text-gray-500 uppercase">
              <th className="p-4">Comercio</th>
              <th className="p-4">Monto Mensual</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Próximo Vencimiento</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {suscripciones.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="p-4 font-bold">{sub.comercio?.nombre}</td>
                <td className="p-4">{formatCurrency(sub.precio_acordado)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                    sub.estado === 'activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {sub.estado}
                  </span>
                </td>
                <td className="p-4">{formatDate(sub.proximo_vencimiento)}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => registrarPago(sub.id, sub.precio_acordado)}
                    disabled={loadingId === sub.id}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {loadingId === sub.id ? 'Registrando...' : 'Registrar Pago de $10.000'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};