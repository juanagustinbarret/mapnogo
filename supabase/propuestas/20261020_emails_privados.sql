-- =====================================================================
-- Emails de los comercios fuera de la vista pública (20/10/2026)
-- =====================================================================
--
-- NO SE EJECUTÓ. Para correr a mano en Supabase → SQL Editor, DESPUÉS de
-- publicar la versión de la app que pide columnas explícitas
-- (src/lib/columnasPublicas.ts). Si se corre antes, el inicio se queda sin
-- comercios.
--
-- Problema: cualquier visitante sin sesión puede leer email_comercial de
-- todos los comercios llamando a la API con la clave pública del sitio. La
-- app ya no lo pide, pero la base lo sigue entregando a quien lo pida. La
-- Política de privacidad dice que el email no se publica (Ley 25.326).
--
-- Qué hace: a los visitantes SIN sesión (rol anon) les deja leer todas las
-- columnas de comercios menos email_comercial. Los usuarios con sesión
-- (admin y comerciantes) siguen igual.
--
-- Límites:
--  - Un comerciante con sesión todavía puede leer emails de otros comercios.
--    Para cerrarlo del todo, a futuro: mover el email a una tabla aparte
--    (comercios_privado) con RLS de dueño y admin.
--  - Si más adelante agregan una columna pública a comercios, hay que volver
--    a correr el bloque 2 (o un GRANT SELECT (columna) ON public.comercios TO anon).
--    Sin eso, la app no la ve sin sesión.
-- =====================================================================

-- 1. Seguridad: la app pide las columnas de delivery; si no existen, cortar acá
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'comercios'
        AND column_name IN ('tiene_delivery', 'delivery_pausado_hasta')) < 2 THEN
    RAISE EXCEPTION 'Faltan las columnas de delivery en comercios (supabase/propuestas/20261018_delivery.sql). No se cambió nada.';
  END IF;
END $$;

-- 2. Sin sesión: todas las columnas menos el email
DO $$
DECLARE
  columnas text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO columnas
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'comercios' AND column_name <> 'email_comercial';

  EXECUTE 'REVOKE SELECT ON public.comercios FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.comercios TO anon', columnas);
END $$;

NOTIFY pgrst, 'reload schema';

-- 3. Comprobación (solo lee): email_comercial tiene que dar false
SELECT column_name, has_column_privilege('anon', 'public.comercios', column_name, 'SELECT') AS anon_puede_leer
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comercios'
ORDER BY ordinal_position;

-- Para deshacer:
-- GRANT SELECT ON public.comercios TO anon;
