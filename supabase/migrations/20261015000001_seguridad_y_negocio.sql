-- =====================================================================
-- Seguridad y reglas de negocio (revisión de octubre 2026)
--
-- Qué hace esta migración:
--   1. Reemplaza TODAS las políticas RLS de las tablas de la app por un
--      conjunto conocido y versionado (incluidas las creadas a mano).
--   2. Centraliza el chequeo de admin en es_admin() (SECURITY DEFINER).
--   3. Impide que un comerciante cambie columnas de administración.
--   4. Versiona horarios_atencion y metricas_interacciones, que existían
--      solo en la base real.
--   5. Agrega funciones para registrar pagos, interacciones y métricas,
--      y marca suscripciones vencidas todos los días (pg_cron).
--   6. Baja lógica de comercios e índices para las claves foráneas.
--
-- Es idempotente: se puede correr más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Columnas nuevas y tablas que faltaban en el repo
-- ---------------------------------------------------------------------
ALTER TABLE public.comercios ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
ALTER TABLE public.comercios ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Convención de días: 0 = Lunes ... 6 = Domingo
CREATE TABLE IF NOT EXISTS public.horarios_atencion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  turno INT NOT NULL DEFAULT 1 CHECK (turno IN (1, 2)),
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  cruza_medianoche BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (comercio_id, dia_semana, turno)
);
-- Si la tabla ya existía (creada a mano), aseguramos las columnas que usa la app
ALTER TABLE public.horarios_atencion ADD COLUMN IF NOT EXISTS turno INT NOT NULL DEFAULT 1;
ALTER TABLE public.horarios_atencion ADD COLUMN IF NOT EXISTS cruza_medianoche BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.horarios_atencion ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.metricas_interacciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  tipo_interaccion TEXT NOT NULL CHECK (tipo_interaccion IN ('visita', 'whatsapp', 'como_llegar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 1. Funciones auxiliares de permisos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'admin' AND estado = 'activo'
  );
$$;

CREATE OR REPLACE FUNCTION public.es_duenio_comercio(p_comercio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comercios
    WHERE id = p_comercio_id AND propietario_id = auth.uid()
  );
$$;

-- Un comercio es público si está aprobado, habilitado, no fue dado de baja
-- y su suscripción está activa.
CREATE OR REPLACE FUNCTION public.es_comercio_publico(comercio_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT c.aprobado
       AND c.habilitado_admin
       AND c.eliminado_en IS NULL
       AND COALESCE(s.estado = 'activa', false)
    FROM public.comercios c
    LEFT JOIN public.suscripciones s ON s.comercio_id = c.id
    WHERE c.id = comercio_uuid
  ), false);
$$;

-- ---------------------------------------------------------------------
-- 2. Borrar TODAS las políticas existentes de las tablas de la app
--    (así no quedan reglas permisivas creadas a mano en el panel)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'comercios', 'rubros', 'planes', 'horarios_atencion',
        'promociones', 'suscripciones', 'periodos_suscripcion', 'pagos',
        'recordatorios_whatsapp', 'configuracion_sistema', 'metricas_interacciones'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubros                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_atencion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_suscripcion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sistema  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricas_interacciones ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Políticas
-- ---------------------------------------------------------------------

-- profiles: cada uno ve su perfil; el rol solo lo cambia un admin.
CREATE POLICY "Perfiles: lectura propia o admin" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.es_admin());
CREATE POLICY "Perfiles: admin gestiona" ON public.profiles
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

-- rubros y planes: lectura pública; escritura solo admin.
CREATE POLICY "Rubros: lectura pública" ON public.rubros
  FOR SELECT USING (true);
CREATE POLICY "Rubros: admin gestiona" ON public.rubros
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY "Planes: lectura pública" ON public.planes
  FOR SELECT USING (true);
CREATE POLICY "Planes: admin gestiona" ON public.planes
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

-- comercios
CREATE POLICY "Comercios: lectura" ON public.comercios
  FOR SELECT USING (
    public.es_comercio_publico(id) OR propietario_id = auth.uid() OR public.es_admin()
  );
CREATE POLICY "Comercios: el dueño edita su ficha" ON public.comercios
  FOR UPDATE USING (propietario_id = auth.uid() AND eliminado_en IS NULL)
  WITH CHECK (propietario_id = auth.uid());
CREATE POLICY "Comercios: admin gestiona" ON public.comercios
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

-- horarios_atencion
CREATE POLICY "Horarios: lectura" ON public.horarios_atencion
  FOR SELECT USING (
    public.es_comercio_publico(comercio_id)
    OR public.es_duenio_comercio(comercio_id)
    OR public.es_admin()
  );
CREATE POLICY "Horarios: dueño o admin gestionan" ON public.horarios_atencion
  FOR ALL USING (public.es_duenio_comercio(comercio_id) OR public.es_admin())
  WITH CHECK (public.es_duenio_comercio(comercio_id) OR public.es_admin());

-- promociones: el público ve solo las vigentes y aprobadas de comercios públicos.
CREATE POLICY "Promociones: lectura" ON public.promociones
  FOR SELECT USING (
    (aprobada AND fecha_fin >= NOW() AND public.es_comercio_publico(comercio_id))
    OR public.es_duenio_comercio(comercio_id)
    OR public.es_admin()
  );
CREATE POLICY "Promociones: dueño o admin gestionan" ON public.promociones
  FOR ALL USING (public.es_duenio_comercio(comercio_id) OR public.es_admin())
  WITH CHECK (public.es_duenio_comercio(comercio_id) OR public.es_admin());

-- suscripciones, períodos y pagos: el dueño solo lee lo suyo; escribe el admin.
CREATE POLICY "Suscripciones: lectura dueño o admin" ON public.suscripciones
  FOR SELECT USING (public.es_duenio_comercio(comercio_id) OR public.es_admin());
CREATE POLICY "Suscripciones: admin gestiona" ON public.suscripciones
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY "Períodos: lectura dueño o admin" ON public.periodos_suscripcion
  FOR SELECT USING (
    public.es_admin() OR EXISTS (
      SELECT 1 FROM public.suscripciones s
      WHERE s.id = suscripcion_id AND public.es_duenio_comercio(s.comercio_id)
    )
  );
CREATE POLICY "Períodos: admin gestiona" ON public.periodos_suscripcion
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY "Pagos: admin gestiona" ON public.pagos
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

-- recordatorios y configuración: solo admin.
CREATE POLICY "Recordatorios: admin gestiona" ON public.recordatorios_whatsapp
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());
CREATE POLICY "Configuración: admin gestiona" ON public.configuracion_sistema
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

-- métricas: nadie inserta directo (se usa registrar_interaccion);
-- leen el dueño y el admin.
CREATE POLICY "Métricas: lectura dueño o admin" ON public.metricas_interacciones
  FOR SELECT USING (public.es_duenio_comercio(comercio_id) OR public.es_admin());

-- ---------------------------------------------------------------------
-- 4. Triggers de protección
-- ---------------------------------------------------------------------

-- El comerciante no puede tocar columnas de administración de su comercio.
-- SECURITY INVOKER a propósito: current_user es el rol de quien edita.
CREATE OR REPLACE FUNCTION public.proteger_columnas_comercio()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.es_admin() THEN
    IF NEW.aprobado         IS DISTINCT FROM OLD.aprobado
    OR NEW.habilitado_admin IS DISTINCT FROM OLD.habilitado_admin
    OR NEW.propietario_id   IS DISTINCT FROM OLD.propietario_id
    OR NEW.nombre           IS DISTINCT FROM OLD.nombre
    OR NEW.slug             IS DISTINCT FROM OLD.slug
    OR NEW.rubro_id         IS DISTINCT FROM OLD.rubro_id
    OR NEW.eliminado_en     IS DISTINCT FROM OLD.eliminado_en THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar ese dato del comercio'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_columnas_comercio ON public.comercios;
CREATE TRIGGER trg_proteger_columnas_comercio
  BEFORE UPDATE ON public.comercios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_comercio();

-- Promociones: el comerciante no puede autodestacarse ni saltear la
-- moderación, y no puede superar el límite de promociones de su plan.
CREATE OR REPLACE FUNCTION public.validar_promocion()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_limite INT;
  v_activas INT;
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.es_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.aprobada := true;   -- publicación inmediata; el admin puede ocultarla
      NEW.destacada := false;
    ELSE
      NEW.aprobada := OLD.aprobada;
      NEW.destacada := OLD.destacada;
      NEW.comercio_id := OLD.comercio_id;
    END IF;
  END IF;

  IF NEW.fecha_fin < NEW.fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de fin de la promoción debe ser posterior a la de inicio';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT p.limite_promociones INTO v_limite
    FROM public.suscripciones s
    JOIN public.planes p ON p.id = s.plan_id
    WHERE s.comercio_id = NEW.comercio_id;

    v_limite := COALESCE(v_limite, 5);

    SELECT count(*) INTO v_activas
    FROM public.promociones
    WHERE comercio_id = NEW.comercio_id AND fecha_fin >= NOW();

    IF v_activas >= v_limite THEN
      RAISE EXCEPTION 'Alcanzaste el límite de % promociones activas de tu plan', v_limite;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_promocion ON public.promociones;
CREATE TRIGGER trg_validar_promocion
  BEFORE INSERT OR UPDATE ON public.promociones
  FOR EACH ROW EXECUTE FUNCTION public.validar_promocion();

-- ---------------------------------------------------------------------
-- 5. Funciones de negocio (RPC)
-- ---------------------------------------------------------------------

-- Registra una interacción pública (visita, WhatsApp, cómo llegar).
-- Freno simple contra abuso: máximo 30 eventos por minuto por comercio y tipo.
CREATE OR REPLACE FUNCTION public.registrar_interaccion(p_comercio_id UUID, p_tipo TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_recientes INT;
BEGIN
  IF p_tipo NOT IN ('visita', 'whatsapp', 'como_llegar') THEN
    RAISE EXCEPTION 'Tipo de interacción inválido';
  END IF;

  IF NOT public.es_comercio_publico(p_comercio_id) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_recientes
  FROM public.metricas_interacciones
  WHERE comercio_id = p_comercio_id
    AND tipo_interaccion = p_tipo
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_recientes >= 30 THEN
    RETURN;
  END IF;

  INSERT INTO public.metricas_interacciones (comercio_id, tipo_interaccion)
  VALUES (p_comercio_id, p_tipo);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_interaccion(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_interaccion(UUID, TEXT) TO anon, authenticated;

-- Totales de métricas de un comercio (opcionalmente desde una fecha).
CREATE OR REPLACE FUNCTION public.metricas_comercio(p_comercio_id UUID, p_desde TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (visitas BIGINT, whatsapp BIGINT, como_llegar BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.es_admin() OR public.es_duenio_comercio(p_comercio_id)) THEN
    RAISE EXCEPTION 'Sin permiso para ver estas métricas' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE m.tipo_interaccion = 'visita'),
    count(*) FILTER (WHERE m.tipo_interaccion = 'whatsapp'),
    count(*) FILTER (WHERE m.tipo_interaccion = 'como_llegar')
  FROM public.metricas_interacciones m
  WHERE m.comercio_id = p_comercio_id
    AND (p_desde IS NULL OR m.created_at >= p_desde);
END;
$$;

REVOKE ALL ON FUNCTION public.metricas_comercio(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metricas_comercio(UUID, TIMESTAMPTZ) TO authenticated;

-- Registra el pago de un período (AAAA-MM) en una sola transacción:
-- crea la suscripción si falta, marca el período como pagado, guarda el
-- pago y extiende el vencimiento al día 10 del mes siguiente al período.
CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_comercio_id UUID,
  p_importe NUMERIC,
  p_metodo payment_method DEFAULT 'transferencia',
  p_periodo TEXT DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL
)
RETURNS public.pagos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub public.suscripciones%ROWTYPE;
  v_plan public.planes%ROWTYPE;
  v_periodo TEXT;
  v_inicio DATE;
  v_periodo_id UUID;
  v_pago public.pagos%ROWTYPE;
  v_cubre_hasta DATE;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar pagos' USING ERRCODE = '42501';
  END IF;

  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'El importe debe ser mayor a cero';
  END IF;

  v_periodo := COALESCE(
    NULLIF(p_periodo, ''),
    to_char((NOW() AT TIME ZONE 'America/Argentina/Cordoba')::date, 'YYYY-MM')
  );
  IF v_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Período inválido: usar el formato AAAA-MM';
  END IF;
  v_inicio := to_date(v_periodo || '-01', 'YYYY-MM-DD');
  v_cubre_hasta := (v_inicio + INTERVAL '1 month' + INTERVAL '9 days')::date;

  SELECT * INTO v_sub FROM public.suscripciones WHERE comercio_id = p_comercio_id FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.planes WHERE estado ORDER BY precio_mensual LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No hay ningún plan activo configurado';
    END IF;

    INSERT INTO public.suscripciones (comercio_id, plan_id, precio_acordado, estado, proximo_vencimiento)
    VALUES (p_comercio_id, v_plan.id, v_plan.precio_mensual, 'activa', v_cubre_hasta)
    RETURNING * INTO v_sub;
  END IF;

  INSERT INTO public.periodos_suscripcion
    (suscripcion_id, periodo_facturado, importe, vencimiento, estado_pago, fecha_pago)
  VALUES
    (v_sub.id, v_periodo, v_sub.precio_acordado, (v_inicio + INTERVAL '9 days')::date, 'pagado', NOW())
  ON CONFLICT (suscripcion_id, periodo_facturado)
  DO UPDATE SET estado_pago = 'pagado', fecha_pago = NOW()
  RETURNING id INTO v_periodo_id;

  INSERT INTO public.pagos (periodo_suscripcion_id, importe, metodo_pago, referencia, registrado_por)
  VALUES (v_periodo_id, p_importe, p_metodo, NULLIF(p_referencia, ''), auth.uid())
  RETURNING * INTO v_pago;

  UPDATE public.suscripciones
     SET estado = CASE WHEN suspension_manual THEN estado ELSE 'activa'::subscription_status END,
         proximo_vencimiento = GREATEST(proximo_vencimiento, v_cubre_hasta)
   WHERE id = v_sub.id;

  RETURN v_pago;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago(UUID, NUMERIC, payment_method, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_pago(UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated;

-- Reemplaza todos los horarios de un comercio en una sola transacción.
-- p_turnos: [{"dia_semana":0,"turno":1,"hora_apertura":"08:00","hora_cierre":"12:00"}, ...]
-- SECURITY INVOKER: se aplican las reglas RLS de quien llama.
CREATE OR REPLACE FUNCTION public.guardar_horarios(p_comercio_id UUID, p_turnos JSONB)
RETURNS void
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT (public.es_duenio_comercio(p_comercio_id) OR public.es_admin()) THEN
    RAISE EXCEPTION 'Sin permiso para editar estos horarios' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.horarios_atencion WHERE comercio_id = p_comercio_id;

  INSERT INTO public.horarios_atencion
    (comercio_id, dia_semana, turno, hora_apertura, hora_cierre, cruza_medianoche, activo)
  SELECT p_comercio_id, t.dia_semana, t.turno, t.hora_apertura, t.hora_cierre,
         t.hora_cierre <= t.hora_apertura, true
  FROM jsonb_to_recordset(COALESCE(p_turnos, '[]'::jsonb))
       AS t(dia_semana INT, turno INT, hora_apertura TIME, hora_cierre TIME);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_horarios(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_horarios(UUID, JSONB) TO authenticated;

-- Pasa a 'vencida' las suscripciones activas cuyo vencimiento más los días
-- de gracia ya pasó. La ejecuta pg_cron todos los días.
CREATE OR REPLACE FUNCTION public.marcar_suscripciones_vencidas()
RETURNS INT
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH actualizadas AS (
    UPDATE public.suscripciones
       SET estado = 'vencida'
     WHERE estado = 'activa'
       AND NOT suspension_manual
       AND proximo_vencimiento + dias_gracia < (NOW() AT TIME ZONE 'America/Argentina/Cordoba')::date
    RETURNING 1
  )
  SELECT count(*)::INT FROM actualizadas;
$$;

REVOKE ALL ON FUNCTION public.marcar_suscripciones_vencidas() FROM PUBLIC;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no está disponible (%). Activalo en Database > Extensions y volvé a correr esta migración.', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'marcar-suscripciones-vencidas';
    -- 03:15 UTC = 00:15 en Argentina
    PERFORM cron.schedule(
      'marcar-suscripciones-vencidas',
      '15 3 * * *',
      'SELECT public.marcar_suscripciones_vencidas()'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6. Columnas visibles para visitantes anónimos
--    El público no necesita ver el email, el dueño ni los datos de
--    administración. Las consultas públicas deben pedir columnas
--    explícitas (no select('*')).
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.comercios FROM anon;
GRANT SELECT (
  id, nombre, slug, descripcion_corta, descripcion_completa, rubro_id,
  direccion, latitud, longitud, telefono, whatsapp, sitio_web, instagram,
  facebook, logo_url, galeria_urls, servicios, medios_pago, google_place_id,
  aprobado, habilitado_admin, propietario_id, eliminado_en, created_at
) ON public.comercios TO anon;
-- aprobado, habilitado_admin, propietario_id y eliminado_en quedan visibles
-- porque las reglas RLS los evalúan; no contienen datos personales.
-- email_comercial y updated_at quedan fuera.

-- ---------------------------------------------------------------------
-- 7. Índices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comercios_propietario ON public.comercios (propietario_id);
CREATE INDEX IF NOT EXISTS idx_comercios_rubro ON public.comercios (rubro_id);
CREATE INDEX IF NOT EXISTS idx_promociones_comercio_fin ON public.promociones (comercio_id, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_horarios_atencion_comercio ON public.horarios_atencion (comercio_id);
CREATE INDEX IF NOT EXISTS idx_metricas_comercio_tipo_fecha
  ON public.metricas_interacciones (comercio_id, tipo_interaccion, created_at);
CREATE INDEX IF NOT EXISTS idx_suscripciones_vencimiento ON public.suscripciones (proximo_vencimiento);
