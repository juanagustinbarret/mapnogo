-- =====================================================================
-- Que el dueño no pueda cambiar datos de administración de su comercio (27/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Probar primero en una copia o
-- en un proyecto de desarrollo; después correr en Supabase → SQL Editor.
--
-- Problema: la política "Comerciante edita su comercio"
-- (supabase/migrations/20261009000002_politicas_rls.sql) deja al dueño
-- cambiar CUALQUIER columna de su fila desde la consola del navegador:
-- volver a mostrarse si el admin lo ocultó (habilitado_admin), aprobarse solo
-- (aprobado), cambiar el slug o el logo, o meter fotos sin moderar en
-- galeria_urls.
--
-- Es el trigger que quedó comentado en 20261021_moderacion_imagenes.sql, con
-- un cambio: el dueño puede QUITAR fotos viejas de galeria_urls, pero no
-- agregar. La app no se ve afectada. El dueño edita descripción, dirección,
-- WhatsApp, medios de pago, delivery y pausa del delivery, y las fotos nuevas
-- pasan por la Edge Function. Admin, clave de servicio y SQL Editor siguen
-- pudiendo todo.
-- =====================================================================

-- ─── PARTE 1: revisar antes (solo lectura) ─────────────────────────────
SELECT policyname, cmd, qual, with_check FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'comercios';
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.comercios'::regclass AND NOT tgisinternal;

-- ─── PARTE 2: el trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proteger_columnas_comercio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sin usuario (SQL Editor, clave de servicio de las Edge Functions) o
  -- admin: puede todo. (No se usa current_user: dentro de una función
  -- SECURITY DEFINER siempre es el dueño de la función.)
  IF auth.uid() IS NULL
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.habilitado_admin IS DISTINCT FROM OLD.habilitado_admin
     OR NEW.aprobado IS DISTINCT FROM OLD.aprobado
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.logo_url IS DISTINCT FROM OLD.logo_url
     OR NOT (coalesce(NEW.galeria_urls, '{}') <@ coalesce(OLD.galeria_urls, '{}'))
     OR NEW.propietario_id IS DISTINCT FROM OLD.propietario_id THEN
    RAISE EXCEPTION 'Ese dato solo lo puede cambiar un administrador' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.proteger_columnas_comercio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proteger_columnas_comercio ON public.comercios;
CREATE TRIGGER proteger_columnas_comercio BEFORE UPDATE ON public.comercios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_comercio();

-- ─── PARTE 3: comprobar (con la sesión de un comerciante de prueba) ────
-- En la consola del navegador, con el panel abierto como comerciante:
--   await supabase.from('comercios').update({ aprobado: true }).eq('id', '<id de su comercio>')
--   → tiene que volver error 42501 "Ese dato solo lo puede cambiar un administrador".
--   Guardar el perfil desde el panel (descripción, WhatsApp) tiene que seguir andando.

-- ─── VOLVER ATRÁS ──────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS proteger_columnas_comercio ON public.comercios;
-- DROP FUNCTION IF EXISTS public.proteger_columnas_comercio();
