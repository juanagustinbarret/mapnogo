import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, MessageSquare, Settings } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const [plantillas, setPlantillas] = useState({
    proximo_vencimiento: '',
    pago_vencido: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    cargarConfig();
  }, []);

  const cargarConfig = async () => {
    const { data } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', 'plantillas_whatsapp')
      .single();

    if (data) {
      setPlantillas(data.valor);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const { error } = await supabase.from('configuracion_sistema').upsert({
      clave: 'plantillas_whatsapp',
      valor: plantillas,
      updated_at: new Date().toISOString(),
    });

    setLoading(false);
    if (!error) setSuccess(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Settings className="w-6 h-6 text-brand-600" /> Configuración de Plantillas de WhatsApp
      </h1>

      {success && (
        <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm font-semibold">
          ¡Plantillas actualizadas correctamente!
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600" /> Plantilla: Próximo Vencimiento (Día 8 al 10)
          </label>
          <p className="text-xs text-gray-500">Variables disponibles: [NOMBRE DEL COMERCIO], [IMPORTE], [PERIODO], [FECHA DE VENCIMIENTO]</p>
          <textarea
            rows={5}
            value={plantillas.proximo_vencimiento}
            onChange={(e) => setPlantillas({ ...plantillas, proximo_vencimiento: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-red-600" /> Plantilla: Deuda Vencida
          </label>
          <p className="text-xs text-gray-500">Variables disponibles: [NOMBRE DEL COMERCIO], [IMPORTE], [PERIODO], [FECHA DE VENCIMIENTO]</p>
          <textarea
            rows={5}
            value={plantillas.pago_vencido}
            onChange={(e) => setPlantillas({ ...plantillas, pago_vencido: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono dark:bg-gray-900 dark:border-gray-700"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition"
        >
          <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar Plantillas'}
        </button>
      </form>
    </div>
  );
};