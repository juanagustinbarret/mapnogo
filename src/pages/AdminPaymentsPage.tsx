import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comercio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CreditCard, CheckCircle, XCircle, Search, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

function calcularAntiguedadMeses(fechaCreacion: string) {
  const inicio = new Date(fechaCreacion);
  const hoy = new Date();
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  return meses <= 0 ? 'Menos de 1 mes' : `${meses} meses`;
}

export const AdminPaymentsPage: React.FC = () => {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Registrar Pago
  const [comercioModalPago, setComercioModalPago] = useState<Comercio | null>(null);
  const [montoPago, setMontoPago] = useState('10000');
  const [metodoPago, setMetodoPago] = useState('Transferencia');

  useEffect(() => {
    fetchComercios();
  }, []);

  const fetchComercios = async () => {
    setLoading(true);
    const { data } = await supabase.from('comercios').select('*, rubro:rubros(*)').order('created_at', { ascending: false });
    if (data) setComercios(data);
    setLoading(false);
  };

  const handleToggleEstadoPago = async (id: string, estadoActual: boolean) => {
    await supabase.from('comercios').update({ habilitado_admin: !estadoActual }).eq('id', id);
    fetchComercios();
  };

  const handleConfirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercioModalPago) return;

    // Habilitar el comercio
    await supabase.from('comercios').update({ habilitado_admin: true }).eq('id', comercioModalPago.id);

    alert(`✅ Pago registrado para ${comercioModalPago.nombre} por ${formatCurrency(parseFloat(montoPago))} vía ${metodoPago}`);
    setComercioModalPago(null);
    fetchComercios();
  };

  const filtrados = comercios.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || c.direccion.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-600" /> Registro de Pagos y Miembros
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Auditoría de ingresos mensual, antigüedad de los comercios y activación en el mapa público.
          </p>
        </div>

        <Link to="/admin" className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl">
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border rounded-xl text-sm"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando registros...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs font-bold text-gray-500 uppercase">
                  <th className="p-4">Comercio</th>
                  <th className="p-4">Miembro Desde</th>
                  <th className="p-4">Antigüedad</th>
                  <th className="p-4">Estado Pago</th>
                  <th className="p-4 text-right">Registrar Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td className="p-4 font-bold">{c.nombre}</td>
                    <td className="p-4 text-xs">{formatDate(c.created_at)}</td>
                    <td className="p-4 text-xs font-semibold text-brand-600">{calcularAntiguedadMeses(c.created_at)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleEstadoPago(c.id, c.habilitado_admin)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                          c.habilitado_admin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.habilitado_admin ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {c.habilitado_admin ? 'Al día' : 'Pendiente'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setComercioModalPago(c)}
                        className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Marcar Pago
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {comercioModalPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg">Registrar Pago para {comercioModalPago.nombre}</h3>
            <form onSubmit={handleConfirmarPago} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Monto ($)</label>
                <input
                  type="number"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-sm dark:bg-gray-900"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Mano</option>
                  <option value="MercadoPago">MercadoPago</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setComercioModalPago(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold">Confirmar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};