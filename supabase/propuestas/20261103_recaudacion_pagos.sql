-- =====================================================================
-- Recaudación del mes desde los pagos, pagos sin duplicados y auditoría (03/11/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Probar primero en una copia o
-- en un proyecto de desarrollo; después correr en Supabase → SQL Editor.
--
-- Problema:
--   - "Recaudación activa" del panel de admin sumaba en el navegador el
--     precio_acordado de las suscripciones activas: registrar un pago no la
--     movía. Ahora es lo cobrado en el mes en curso (hora de Argentina), sumado
--     en el servidor a partir de la tabla pagos.
--   - Un doble clic o un reintento podía registrar dos veces el mismo pago.
--   - El navegador mandaba quién registró el pago (p_registrado_por).
--
-- Qué hace:
--   1. recaudacion_mes_actual(): total del mes en centavos. Solo admin.
--   2. registrar_pago_seguro(): valida, toma el admin de la sesión y usa una
--      clave por intento (pagos_solicitudes) para no registrar dos veces.
--      Por dentro llama a registrar_pago_comercio, que se creó desde el SQL
--      Editor y no está en el repo: no se cambia su cuerpo.
--   3. registrar_pago_comercio deja de poder llamarse desde el navegador:
--      solo a través de registrar_pago_seguro.
--   4. auditoria_pagos: quién, cuándo, qué y cuánto, en cada alta, edición o
--      baja de un pago (trigger sobre pagos). Al eliminar un pago la
--      recaudación baja y el rastro queda.
--
-- Orden de publicación: correr este SQL ANTES de publicar la versión del
-- sitio que lo usa. Si el sitio se publica antes, el registro de pagos sigue
-- andando con la función vieja y la recaudación muestra "Sin datos".
-- =====================================================================

-- ─── PARTE 1: revisar antes (solo lectura) ─────────────────────────────
SELECT p.oid::regprocedure AS funcion, p.prosecdef AS security_definer
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('registrar_pago_comercio', 'editar_pago_comercio', 'eliminar_pago_comercio');
SELECT unnest(enum_range(NULL::public.payment_method)) AS metodos_validos;
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.pagos'::regclass AND NOT tgisinternal;

-- ─── PARTE 2: el cambio ────────────────────────────────────────────────
BEGIN;

-- 2.1 Auditoría de pagos (solo la escribe el trigger; la lee el admin)
CREATE TABLE IF NOT EXISTS public.auditoria_pagos (
  id               BIGSERIAL PRIMARY KEY,
  pago_id          UUID NOT NULL,
  accion           TEXT NOT NULL CHECK (accion IN ('registrar', 'editar', 'eliminar')),
  importe_antes    NUMERIC(12,2),
  importe_despues  NUMERIC(12,2),
  metodo_pago      TEXT,
  usuario          UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin lee auditoria de pagos" ON public.auditoria_pagos;
CREATE POLICY "Admin lee auditoria de pagos" ON public.auditoria_pagos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE OR REPLACE FUNCTION public.auditar_pago()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria_pagos (pago_id, accion, importe_despues, metodo_pago, usuario)
    VALUES (NEW.id, 'registrar', NEW.importe, NEW.metodo_pago::text, coalesce(auth.uid(), NEW.registrado_por));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria_pagos (pago_id, accion, importe_antes, importe_despues, metodo_pago, usuario)
    VALUES (NEW.id, 'editar', OLD.importe, NEW.importe, NEW.metodo_pago::text, auth.uid());
    RETURN NEW;
  END IF;
  INSERT INTO public.auditoria_pagos (pago_id, accion, importe_antes, metodo_pago, usuario)
  VALUES (OLD.id, 'eliminar', OLD.importe, OLD.metodo_pago::text, auth.uid());
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.auditar_pago() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auditar_pago ON public.pagos;
CREATE TRIGGER auditar_pago AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_pago();

-- 2.2 Una clave por intento de registro: la misma clave no registra dos veces
CREATE TABLE IF NOT EXISTS public.pagos_solicitudes (
  clave           UUID PRIMARY KEY,
  comercio_id     UUID NOT NULL,
  importe         NUMERIC(12,2) NOT NULL,
  registrado_por  UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pagos_solicitudes ENABLE ROW LEVEL SECURITY; -- sin políticas: solo la función

CREATE OR REPLACE FUNCTION public.registrar_pago_seguro(p_clave uuid, p_comercio_id uuid, p_importe numeric, p_metodo_pago text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin  uuid := auth.uid();
  v_metodo text := lower(trim(coalesce(p_metodo_pago, '')));
  v_validos text[] := ARRAY(SELECT unnest(enum_range(NULL::public.payment_method))::text);
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin AND rol = 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar pagos' USING ERRCODE = '42501';
  END IF;
  IF p_clave IS NULL OR p_comercio_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos del pago' USING ERRCODE = '22023';
  END IF;
  IF p_importe IS NULL OR p_importe <= 0 OR p_importe > 9999999999.99 OR p_importe <> round(p_importe, 2) THEN
    RAISE EXCEPTION 'Importe inválido' USING ERRCODE = '22023';
  END IF;
  -- El sitio manda "mercadopago"; se acepta con o sin guion bajo, según cómo esté el tipo en la base
  IF NOT v_metodo = ANY (v_validos) THEN
    v_metodo := CASE WHEN replace(v_metodo, '_', '') = 'mercadopago'
                     THEN (SELECT m FROM unnest(v_validos) m WHERE replace(m, '_', '') = 'mercadopago' LIMIT 1) END;
  END IF;
  IF v_metodo IS NULL THEN
    RAISE EXCEPTION 'Método de pago inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comercios WHERE id = p_comercio_id) THEN
    RAISE EXCEPTION 'No existe ese comercio' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pagos_solicitudes (clave, comercio_id, importe, registrado_por)
  VALUES (p_clave, p_comercio_id, round(p_importe, 2), v_admin)
  ON CONFLICT (clave) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('registrado', false, 'duplicado', true);
  END IF;

  -- Argumentos como literales: se adaptan a los tipos que tenga la función existente
  EXECUTE format('SELECT public.registrar_pago_comercio(p_comercio_id => %L, p_importe => %L, p_metodo_pago => %L, p_registrado_por => %L)',
                 p_comercio_id, round(p_importe, 2), v_metodo, v_admin);
  RETURN jsonb_build_object('registrado', true, 'duplicado', false);
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_pago_seguro(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_seguro(uuid, uuid, numeric, text) TO authenticated;

-- La función vieja ya no se llama directo desde el navegador
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'registrar_pago_comercio' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- 2.3 Recaudación del mes (centavos, hora de Argentina)
CREATE OR REPLACE FUNCTION public.recaudacion_mes_actual(p_referencia timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_desde date := date_trunc('month', p_referencia AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_hasta date := (v_desde + interval '1 month')::date;
  v_total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede ver la recaudación' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(sum(round(importe * 100)), 0)::bigint INTO v_total
    FROM public.pagos
   WHERE fecha_pago >= (v_desde::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
     AND fecha_pago <  (v_hasta::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  RETURN jsonb_build_object('total_centavos', v_total, 'desde', v_desde, 'hasta', v_hasta - 1);
END $$;
REVOKE EXECUTE ON FUNCTION public.recaudacion_mes_actual(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recaudacion_mes_actual(timestamptz) TO authenticated;

COMMIT;

-- ─── PARTE 3: comprobar ────────────────────────────────────────────────
-- En el sitio, con sesión de admin:
--   1. Abrir /admin y anotar "Recaudación activa".
--   2. En /admin/pagos registrar un pago de $ 1.234,56 (doble clic en Confirmar).
--   3. Volver a /admin: la cifra subió 1.234,56 una sola vez.
--   4. Eliminar ese pago en la auditoría de /admin/pagos: la cifra vuelve a la anterior.
-- En el SQL Editor:
--   SELECT accion, importe_antes, importe_despues, usuario, created_at
--     FROM public.auditoria_pagos ORDER BY id DESC LIMIT 5;   -- registrar y eliminar
-- Con sesión de comerciante, en la consola del navegador:
--   await supabase.rpc('recaudacion_mes_actual')   → error 42501
--   await supabase.rpc('registrar_pago_comercio', {...}) → error de permiso

-- ─── VOLVER ATRÁS ──────────────────────────────────────────────────────
-- (Antes de volver atrás, publicar la versión anterior del sitio.)
-- DROP FUNCTION IF EXISTS public.recaudacion_mes_actual(timestamptz);
-- DROP FUNCTION IF EXISTS public.registrar_pago_seguro(uuid, uuid, numeric, text);
-- DROP TRIGGER IF EXISTS auditar_pago ON public.pagos;
-- DROP FUNCTION IF EXISTS public.auditar_pago();
-- DROP TABLE IF EXISTS public.pagos_solicitudes;
-- DROP TABLE IF EXISTS public.auditoria_pagos;   -- borra el historial de auditoría
-- Y devolver el permiso a la función vieja (con la firma de la PARTE 1):
-- GRANT EXECUTE ON FUNCTION public.registrar_pago_comercio(<firma>) TO authenticated;
