-- =====================================================================
-- Delivery activo (NOGOMAP, 18/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor cuando estén de acuerdo. Es todo aditivo: no
-- borra ni renombra nada, y los comercios existentes quedan SIN delivery
-- (tiene_delivery = false) hasta que el dueño lo active en su panel.
--
-- El frontend de esta rama ya funciona sin esto: si la tabla no existe,
-- el mapa simplemente no muestra delivery y el panel del comerciante
-- avisa que "todavía no está habilitado".
--
-- Reglas de los horarios (las mismas que src/lib/delivery.ts):
--   - dia_semana: 0 = Lunes … 6 = Domingo (igual que horarios_atencion).
--   - [hora_inicio, hora_fin): inicio inclusivo, fin exclusivo.
--   - Si hora_fin <= hora_inicio, el rango cruza la medianoche y pertenece
--     al día en que empieza (lunes 20:00–02:00 sigue activo el martes 00:30).
--   - 24 hs = 00:00–24:00 (Postgres acepta '24:00' en columnas time).
--   - Se evalúan siempre en hora de Argentina, del lado del navegador,
--     igual que "Abiertos Ahora".
-- =====================================================================

-- 1. Marca en el comercio
ALTER TABLE public.comercios
  ADD COLUMN IF NOT EXISTS tiene_delivery BOOLEAN NOT NULL DEFAULT false;

-- 2. Rangos de delivery (uno o más por día)
CREATE TABLE IF NOT EXISTS public.horarios_delivery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT horarios_delivery_inicio_distinto_fin CHECK (hora_inicio <> hora_fin),
  CONSTRAINT horarios_delivery_inicio_valido CHECK (hora_inicio < '24:00')
);

CREATE INDEX IF NOT EXISTS idx_horarios_delivery_comercio
  ON public.horarios_delivery (comercio_id, dia_semana);

-- 3. Seguridad (RLS)
ALTER TABLE public.horarios_delivery ENABLE ROW LEVEL SECURITY;

-- Lectura: los rangos se ven si se ve el comercio. La subconsulta corre con
-- las políticas de comercios del que pregunta, así que hereda exactamente
-- la misma visibilidad (públicos, el dueño y los admin).
DROP POLICY IF EXISTS "Delivery visible si el comercio es visible" ON public.horarios_delivery;
CREATE POLICY "Delivery visible si el comercio es visible" ON public.horarios_delivery
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.comercios c WHERE c.id = horarios_delivery.comercio_id)
  );

-- Escritura: cada dueño solo toca el delivery de SU comercio.
DROP POLICY IF EXISTS "Dueño gestiona su delivery" ON public.horarios_delivery;
CREATE POLICY "Dueño gestiona su delivery" ON public.horarios_delivery
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.comercios c
            WHERE c.id = horarios_delivery.comercio_id AND c.propietario_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.comercios c
            WHERE c.id = horarios_delivery.comercio_id AND c.propietario_id = auth.uid())
  );

-- Admin: todo.
DROP POLICY IF EXISTS "Admin gestiona delivery" ON public.horarios_delivery;
CREATE POLICY "Admin gestiona delivery" ON public.horarios_delivery
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

GRANT SELECT ON public.horarios_delivery TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.horarios_delivery TO authenticated;

-- La columna tiene_delivery la cambia el dueño con la política que ya
-- existe "Comerciante edita su comercio" (UPDATE donde propietario_id =
-- auth.uid()). No hace falta una política nueva.

-- 4. Comprobación (solo lectura)
-- SELECT count(*) FILTER (WHERE tiene_delivery) AS con_delivery, count(*) AS total FROM public.comercios;
