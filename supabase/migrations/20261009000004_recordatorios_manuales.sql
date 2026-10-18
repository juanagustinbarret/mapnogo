-- 1. TIPOS ENUMERADOS PARA RECORDATORIOS
CREATE TYPE reminder_status AS ENUM ('pendiente', 'gestionado', 'no_corresponde');

-- 2. TABLA DE REGISTRO DE RECORDATORIOS MANUALES
CREATE TABLE IF NOT EXISTS public.recordatorios_whatsapp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  suscripcion_id UUID NOT NULL REFERENCES public.suscripciones(id) ON DELETE CASCADE,
  periodo_facturado VARCHAR(7) NOT NULL, -- "YYYY-MM"
  estado reminder_status NOT NULL DEFAULT 'pendiente',
  fecha_gestion TIMESTAMPTZ,
  gestionado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Previene duplicar registros para el mismo comercio y período
  UNIQUE(comercio_id, periodo_facturado)
);

-- 3. TABLA DE CONFIGURACIÓN DE PLANTILLAS Y DÍAS (SINO EXISTE)
CREATE TABLE IF NOT EXISTS public.configuracion_sistema (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar plantillas predeterminadas de WhatsApp
INSERT INTO public.configuracion_sistema (clave, valor)
VALUES (
  'plantillas_whatsapp',
  '{
    "proximo_vencimiento": "Hola, ¿cómo estás? 👋\nTe recordamos que el día 10 vence la suscripción mensual de [NOMBRE DEL COMERCIO] a NOGOMAP, por un importe de [IMPORTE].\nCuando realices el pago, avisanos para que podamos registrarlo.\n¡Muchas gracias por ser parte de NOGOMAP! 🙌",
    "pago_vencido": "Hola, ¿cómo estás? 👋\nTe contactamos de NOGOMAP porque registramos pendiente el pago del período [PERIODO] de [NOMBRE DEL COMERCIO] por un importe de [IMPORTE].\nPor favor, confirmanos si pudiste realizar la transferencia para regularizar la ficha comercial.\n¡Quedamos a disposición por cualquier consulta! 🙌"
  }'::jsonb
) ON CONFLICT (clave) DO NOTHING;

-- 4. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_recordatorios_comercio_periodo ON public.recordatorios_whatsapp(comercio_id, periodo_facturado);
CREATE INDEX IF NOT EXISTS idx_recordatorios_estado ON public.recordatorios_whatsapp(estado);

-- 5. SEGURIDAD Y POLÍTICAS RLS
ALTER TABLE public.recordatorios_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Solo los Administradores pueden leer y modificar los recordatorios y configuraciones
CREATE POLICY "Solo Admin gestiona recordatorios" ON public.recordatorios_whatsapp
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Solo Admin lee y edita configuracion" ON public.configuracion_sistema
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );