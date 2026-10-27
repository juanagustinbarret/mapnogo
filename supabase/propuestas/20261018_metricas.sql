-- =====================================================================
-- Métricas exactas y privadas (NOGOMAP, 18/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, en este orden, cuando estén de acuerdo.
-- Primero publicar el frontend de esta rama: ya llama a
-- registrar_interaccion() y, si no existe, inserta como antes.
--
-- Qué hace (todo aditivo, no borra ni renombra datos):
--   1. Columna nueva visitante_id (identificador anónimo del navegador).
--   2. Función registrar_interaccion(): valida el tipo y el comercio, y no
--      cuenta dos veces el mismo visitante + comercio + tipo en 30 minutos.
--      Usa la hora del servidor (no la del celular).
--   3. Función metricas_comercio(): devuelve los conteos de un período y
--      solo se los da al dueño del comercio o a un admin.
--   4. (Opcional, paso 4) Quitar el INSERT directo a anon/authenticated
--      para que nadie pueda inflar métricas con la anon key pública.
-- =====================================================================

-- 1. Visitante anónimo
ALTER TABLE public.metricas_interacciones
  ADD COLUMN IF NOT EXISTS visitante_id TEXT;

CREATE INDEX IF NOT EXISTS idx_metricas_comercio_tipo_fecha
  ON public.metricas_interacciones (comercio_id, tipo_interaccion, created_at);

-- 2. Registro del lado del servidor, con anti-duplicados
CREATE OR REPLACE FUNCTION public.registrar_interaccion(
  p_comercio_id UUID,
  p_tipo TEXT,
  p_visitante TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tipo NOT IN ('visita', 'whatsapp', 'como_llegar') THEN
    RAISE EXCEPTION 'Tipo de interacción inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_visitante IS NULL OR length(p_visitante) < 8 OR length(p_visitante) > 64 THEN
    RAISE EXCEPTION 'Visitante inválido' USING ERRCODE = '22023';
  END IF;

  -- Solo comercios publicados
  IF NOT EXISTS (
    SELECT 1 FROM comercios c
    WHERE c.id = p_comercio_id AND c.aprobado AND c.habilitado_admin
  ) THEN
    RETURN FALSE;
  END IF;

  -- El dueño mirando su propia ficha no cuenta
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM comercios c WHERE c.id = p_comercio_id AND c.propietario_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;

  -- Mismo visitante + comercio + tipo en los últimos 30 minutos: no se repite
  IF EXISTS (
    SELECT 1 FROM metricas_interacciones m
    WHERE m.comercio_id = p_comercio_id
      AND m.tipo_interaccion = p_tipo
      AND m.visitante_id = p_visitante
      AND m.created_at > now() - interval '30 minutes'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO metricas_interacciones (comercio_id, tipo_interaccion, visitante_id, created_at)
  VALUES (p_comercio_id, p_tipo, p_visitante, now());
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_interaccion(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_interaccion(UUID, TEXT, TEXT) TO anon, authenticated;

-- 3. Lectura autorizada: solo el dueño del comercio o un admin
CREATE OR REPLACE FUNCTION public.metricas_comercio(
  p_comercio_id UUID,
  p_desde DATE,
  p_hasta DATE
) RETURNS TABLE (visitas BIGINT, whatsapp BIGINT, como_llegar BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM comercios c WHERE c.id = p_comercio_id AND c.propietario_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  -- Días argentinos completos: [desde 00:00, hasta+1 00:00) en UTC-3
  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE m.tipo_interaccion = 'visita'),
    count(*) FILTER (WHERE m.tipo_interaccion = 'whatsapp'),
    count(*) FILTER (WHERE m.tipo_interaccion = 'como_llegar')
  FROM metricas_interacciones m
  WHERE m.comercio_id = p_comercio_id
    AND m.created_at >= (p_desde::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    AND m.created_at < ((p_hasta + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
END;
$$;

REVOKE ALL ON FUNCTION public.metricas_comercio(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metricas_comercio(UUID, DATE, DATE) TO authenticated;

-- Política de lectura directa (la usa el panel hoy): cada dueño ve solo las
-- filas de su comercio; los admins, todas. Revisar antes con:
--   SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'metricas_interacciones';
ALTER TABLE public.metricas_interacciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dueño o admin leen métricas" ON public.metricas_interacciones;
CREATE POLICY "Dueño o admin leen métricas" ON public.metricas_interacciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.rol = 'admin')
  );

-- 4. (Opcional, después de comprobar que el paso 2 funciona) Que nadie pueda
-- insertar métricas salteando la función. Revisar el nombre real de la
-- política de INSERT con la consulta de pg_policies de arriba.
-- REVOKE INSERT ON public.metricas_interacciones FROM anon, authenticated;
