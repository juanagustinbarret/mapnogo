-- =====================================================================
-- Fotos de comercios con moderación (21/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes y en orden.
--
-- Hoy las fotos de la galería se guardan como texto (base64) dentro de
-- comercios.galeria_urls, las escribe el navegador sin ningún control y el
-- inicio las descarga para todos los comercios. Con esto:
--   - las fotos nuevas se guardan en Storage (bucket fotos-comercios) y se
--     registran en fotos_comercio con su estado de moderación;
--   - SOLO las sube la Edge Function imagenes-comercio (valida, limpia,
--     modera): nadie puede escribir el bucket ni la tabla desde el navegador;
--   - el público ve solo las aprobadas de comercios públicos;
--   - los reportes de "Reportar foto" quedan en reportes_contenido.
-- PARTE 1 y 2 son ADITIVAS. La PARTE 3 cambia permisos de comercios:
-- leerla antes de correrla.
-- =====================================================================

-- ─── PARTE 1: almacenamiento y tablas ──────────────────────────────────

-- 1.a Bucket público de lectura; tope de 3 MB y solo JPG/PNG/WebP.
--     Sin políticas en storage.objects para anon/authenticated: solo la
--     clave de servicio (la Edge Function) puede subir o borrar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-comercios', 'fotos-comercios', true, 3000000, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 1.b Fotos y su moderación
CREATE TABLE IF NOT EXISTS public.fotos_comercio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  comercio_id  uuid NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  subida_por   uuid,
  estado       text NOT NULL CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  motivo       text,
  moderacion   jsonb,          -- proveedor, puntajes y motivo de la moderación automática
  ruta         text,           -- ruta en el bucket (NULL si se rechazó)
  url          text,           -- URL pública (NULL si se rechazó)
  ancho        int,
  alto         int,
  bytes        int,
  orden        int NOT NULL DEFAULT 0,
  revisada_por uuid,
  revisada_at  timestamptz
);
CREATE INDEX IF NOT EXISTS fotos_comercio_por_comercio ON public.fotos_comercio (comercio_id, estado);
CREATE INDEX IF NOT EXISTS fotos_comercio_por_usuario ON public.fotos_comercio (subida_por, created_at);
CREATE INDEX IF NOT EXISTS fotos_comercio_pendientes ON public.fotos_comercio (created_at) WHERE estado = 'pendiente';

ALTER TABLE public.fotos_comercio ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.fotos_comercio FROM anon, authenticated;

DROP POLICY IF EXISTS "Fotos aprobadas visibles" ON public.fotos_comercio;
CREATE POLICY "Fotos aprobadas visibles" ON public.fotos_comercio FOR SELECT
  USING (estado = 'aprobada' AND public.es_comercio_publico(comercio_id));

DROP POLICY IF EXISTS "Dueño ve sus fotos" ON public.fotos_comercio;
CREATE POLICY "Dueño ve sus fotos" ON public.fotos_comercio FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.comercios c WHERE c.id = fotos_comercio.comercio_id AND c.propietario_id = auth.uid()));

DROP POLICY IF EXISTS "Admin ve todas las fotos" ON public.fotos_comercio;
CREATE POLICY "Admin ve todas las fotos" ON public.fotos_comercio FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

-- 1.c Reportes del público (los inserta la Edge Function, con tope por conexión)
CREATE TABLE IF NOT EXISTS public.reportes_contenido (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  comercio_id    uuid NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  foto_id        uuid REFERENCES public.fotos_comercio(id) ON DELETE SET NULL,
  indice_galeria int,          -- fotos viejas (galeria_urls): posición en la lista
  motivo         text NOT NULL CHECK (motivo IN ('sexual', 'violencia', 'enganosa', 'otro')),
  detalle        text CHECK (detalle IS NULL OR char_length(detalle) <= 500),
  ip_hash        text,         -- huella SHA-256 con sal: no es la IP
  estado         text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'resuelto', 'descartado')),
  resuelto_por   uuid,
  resuelto_at    timestamptz
);
CREATE INDEX IF NOT EXISTS reportes_contenido_abiertos ON public.reportes_contenido (created_at) WHERE estado = 'abierto';
CREATE INDEX IF NOT EXISTS reportes_contenido_por_huella ON public.reportes_contenido (ip_hash, created_at);

ALTER TABLE public.reportes_contenido ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reportes_contenido FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reportes_contenido FROM authenticated;
DROP POLICY IF EXISTS "Admin ve reportes" ON public.reportes_contenido;
CREATE POLICY "Admin ve reportes" ON public.reportes_contenido FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

NOTIFY pgrst, 'reload schema';

-- ─── PARTE 2: verificación (solo lectura) ──────────────────────────────
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'fotos-comercios';
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename IN ('fotos_comercio', 'reportes_contenido') ORDER BY tablename;
-- ¿Cuánto pesan hoy las fotos guardadas como texto dentro de comercios?
SELECT count(*) AS comercios_con_fotos,
       pg_size_pretty(sum(pg_column_size(galeria_urls))::bigint) AS peso_total_galerias
FROM public.comercios WHERE coalesce(array_length(galeria_urls, 1), 0) > 0;

-- ─── PARTE 3: que el dueño no pueda cambiar datos de administración ─────
-- Hallazgo de la revisión: la política "Comerciante edita su comercio" deja
-- al dueño cambiar CUALQUIER columna de su fila desde la consola del
-- navegador: habilitado_admin (volver a mostrarse si el admin lo ocultó),
-- aprobado, slug, propietario_id, logo y galeria_urls (fotos sin moderar).
-- Este trigger lo impide. La app no se ve afectada: el dueño edita
-- descripción, dirección, WhatsApp, medios de pago, horarios y delivery;
-- las fotos nuevas pasan por la Edge Function. Admin, clave de servicio y
-- el SQL Editor siguen pudiendo todo.
--
-- CREATE OR REPLACE FUNCTION public.proteger_columnas_comercio()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- BEGIN
--   -- Sin usuario (SQL Editor, clave de servicio de las Edge Functions) o
--   -- admin: puede todo. (No se usa current_user: dentro de una función
--   -- SECURITY DEFINER siempre es el dueño de la función.)
--   IF auth.uid() IS NULL
--      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin') THEN
--     RETURN NEW;
--   END IF;
--   IF NEW.habilitado_admin IS DISTINCT FROM OLD.habilitado_admin
--      OR NEW.aprobado IS DISTINCT FROM OLD.aprobado
--      OR NEW.slug IS DISTINCT FROM OLD.slug
--      OR NEW.logo_url IS DISTINCT FROM OLD.logo_url
--      OR NEW.galeria_urls IS DISTINCT FROM OLD.galeria_urls
--      OR (NEW.propietario_id IS DISTINCT FROM OLD.propietario_id
--          AND NOT (OLD.propietario_id IS NULL AND NEW.propietario_id = auth.uid())) THEN
--     RAISE EXCEPTION 'Ese dato solo lo puede cambiar un administrador' USING ERRCODE = '42501';
--   END IF;
--   RETURN NEW;
-- END $$;
--
-- DROP TRIGGER IF EXISTS proteger_columnas_comercio ON public.comercios;
-- CREATE TRIGGER proteger_columnas_comercio BEFORE UPDATE ON public.comercios
--   FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_comercio();
