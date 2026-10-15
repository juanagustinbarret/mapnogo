import React, { useEffect, useState } from 'react';
import { MessageSquare, Save, Settings } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { PlantillasWhatsApp } from '@/types/database.types';
import { mensajeError } from '@/lib/formatters';
import { compileTemplate } from '@/lib/whatsapp';
import { PLANTILLAS_POR_DEFECTO, guardarPlantillas, obtenerPlantillas } from '@/services/configuracion';

const VARIABLES = ['[NOMBRE DEL COMERCIO]', '[IMPORTE]', '[PERIODO]', '[FECHA DE VENCIMIENTO]'];

const EJEMPLO = {
  nombreComercio: 'Panadería Ejemplo',
  importe: '$ 10.000',
  periodoFacturado: 'octubre 2026',
  vencimiento: '10/11/2026',
};

const CAMPOS: { clave: keyof PlantillasWhatsApp; titulo: string; ayuda: string }[] = [
  { clave: 'proximo_vencimiento', titulo: 'Recordatorio de vencimiento', ayuda: 'Se usa cuando la suscripción está por vencer.' },
  { clave: 'pago_vencido', titulo: 'Pago vencido', ayuda: 'Se usa cuando la suscripción ya venció y no hay pago del período.' },
];

export const AdminSettingsPage: React.FC = () => {
  const { avisar } = useToast();
  const [plantillas, setPlantillas] = useState<PlantillasWhatsApp>(PLANTILLAS_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerPlantillas()
      .then(setPlantillas)
      .catch((e) => avisar(`No se pudieron cargar las plantillas: ${mensajeError(e)}`, 'error'))
      .finally(() => setCargando(false));
  }, [avisar]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardarPlantillas(plantillas);
      avisar('Plantillas guardadas.', 'exito');
    } catch (err) {
      avisar(`No se pudieron guardar: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="p-12 text-center text-gray-500">Cargando configuración...</div>;

  return (
    <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" aria-hidden="true" /> Plantillas de WhatsApp
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Variables disponibles: {VARIABLES.map((v) => <code key={v} className="mx-0.5 px-1 bg-gray-100 dark:bg-gray-700 rounded">{v}</code>)}
        </p>
      </div>

      {CAMPOS.map(({ clave, titulo, ayuda }) => (
        <div key={clave} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`plantilla-${clave}`} className="block text-sm font-bold mb-1 flex items-center gap-1">
              <MessageSquare className="w-4 h-4 text-green-600" aria-hidden="true" /> {titulo}
            </label>
            <p className="text-[11px] text-gray-400 mb-2">{ayuda}</p>
            <textarea
              id={`plantilla-${clave}`}
              rows={6}
              required
              value={plantillas[clave]}
              onChange={(e) => setPlantillas({ ...plantillas, [clave]: e.target.value })}
              className="w-full p-3 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">Vista previa</p>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl text-sm whitespace-pre-line border border-green-100 dark:border-green-900">
              {compileTemplate(plantillas[clave], EJEMPLO)}
            </div>
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={guardando}
        className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" aria-hidden="true" /> {guardando ? 'Guardando...' : 'Guardar plantillas'}
      </button>
    </form>
  );
};
