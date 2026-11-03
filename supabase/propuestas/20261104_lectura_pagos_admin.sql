-- =====================================================================
-- El admin puede leer pagos, períodos y suscripciones (04/11/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Probar primero en una copia o
-- en un proyecto de desarrollo; después correr en Supabase → SQL Editor.
--
-- Problema: registrar un pago funciona (la "Recaudación activa" sube), pero
-- el historial del comercio y la auditoría de /admin/pagos salen vacíos.
-- pagos, periodos_suscripcion y suscripciones tienen RLS activado
-- (supabase/migrations/20261009000002_politicas_rls.sql) y el repo no tiene
-- ninguna política de lectura para ellas: con RLS y sin política, Supabase
-- no da error, devuelve una lista vacía. La recaudación sí los ve porque la
-- calcula una función SECURITY DEFINER.
--
-- Qué hace: una política de LECTURA para admin en cada tabla. Las políticas
-- se suman (OR): no cambia lo que ya puedan leer otros (por ejemplo, el
-- comercio su propia suscripción). No agrega permisos de escritura: alta,
-- edición y baja de pagos siguen pasando por los RPC.
-- =====================================================================

-- ─── PARTE 1: revisar antes (solo lectura) ─────────────────────────────
SELECT relname AS tabla, relrowsecurity AS rls_activado
  FROM pg_class
 WHERE oid IN ('public.pagos'::regclass, 'public.periodos_suscripcion'::regclass, 'public.suscripciones'::regclass);
SELECT tablename, policyname, cmd, roles, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('pagos', 'periodos_suscripcion', 'suscripciones')
 ORDER BY tablename, policyname;
-- Si "pagos" tiene rls_activado = true y no aparece ninguna política SELECT
-- (o ALL) que incluya al admin, esa es la causa.

-- ─── PARTE 2: el cambio ────────────────────────────────────────────────
BEGIN;

DROP POLICY IF EXISTS "Admin lee pagos" ON public.pagos;
CREATE POLICY "Admin lee pagos" ON public.pagos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

DROP POLICY IF EXISTS "Admin lee periodos de suscripcion" ON public.periodos_suscripcion;
CREATE POLICY "Admin lee periodos de suscripcion" ON public.periodos_suscripcion FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

DROP POLICY IF EXISTS "Admin lee suscripciones" ON public.suscripciones;
CREATE POLICY "Admin lee suscripciones" ON public.suscripciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

COMMIT;

-- ─── PARTE 3: comprobar ────────────────────────────────────────────────
-- 1. En /admin/pagos (sesión de admin): la pestaña de auditoría y el
--    historial de un comercio muestran los pagos ya registrados.
-- 2. Con sesión de comerciante, en la consola del navegador:
--      await supabase.from('pagos').select('id')   → data: []  (no ve pagos)

-- ─── VOLVER ATRÁS ──────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "Admin lee pagos" ON public.pagos;
-- DROP POLICY IF EXISTS "Admin lee periodos de suscripcion" ON public.periodos_suscripcion;
-- DROP POLICY IF EXISTS "Admin lee suscripciones" ON public.suscripciones;
