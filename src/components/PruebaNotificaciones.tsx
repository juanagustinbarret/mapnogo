import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { probarNotificacionEnEsteDispositivo, type ResultadoPrueba } from '@/lib/avisosPromociones';

// Configuración (admin): probar las notificaciones push con el propio
// celular, sin mandarle nada a los vecinos.
export const PruebaNotificaciones: React.FC = () => {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPrueba | null>(null);

  const probar = async () => {
    setEnviando(true);
    setResultado(null);
    setResultado(await probarNotificacionEnEsteDispositivo());
    setEnviando(false);
  };

  return (
    <section className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <BellRing className="w-4 h-4 text-brand-600" /> Notificaciones de ofertas
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Manda una notificación de prueba <b>solo a este dispositivo</b> (a nadie más). Si todavía no activaste las
        notificaciones acá, primero te pide el permiso. En iPhone, abrí NOGOYORK desde el ícono de la pantalla de inicio.
      </p>
      <button
        type="button"
        onClick={probar}
        disabled={enviando}
        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Enviarme una notificación de prueba'}
      </button>
      {resultado && (
        <p role="status" className={`text-xs font-semibold ${resultado.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {resultado.texto}
        </p>
      )}
    </section>
  );
};
