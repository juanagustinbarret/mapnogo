-- =====================================================================
-- Reseñas: una por conexión (IP) y por comercio (20/10/2026)
-- =====================================================================
--
-- NO SE EJECUTÓ. Para correr a mano en Supabase → SQL Editor. Gratis: usa
-- solo Postgres, sin servicios externos.
--
-- Cómo funciona: cuando alguien publica una reseña, la base lee la IP de la
-- petición (la manda el proxy de Supabase en los encabezados, como indica
-- supabase.com/docs/guides/api/securing-your-api, "Request information"),
-- guarda una HUELLA cifrada de esa IP (SHA-256 con una clave secreta, no la
-- IP) y un índice único impide una segunda reseña del mismo comercio desde
-- la misma conexión. El límite lo pone la base: no se puede saltear
-- llamando a la API directo.
--
-- Límites a tener en cuenta:
--  - En los datos móviles, varias personas pueden salir a internet con la
--    misma IP (CGNAT de las compañías). Si pasa, la segunda persona verá
--    "Ya dejaste una reseña para este comercio". Si molesta, se puede borrar
--    la reseña repetida desde el panel o cambiar el índice por un límite
--    por tiempo.
--  - Alguien con VPN o cambiando de red puede dejar otra. Es un freno
--    contra el spam, no una verificación de identidad.
--  - Las reseñas que ya existen quedan sin huella (no cuentan para el límite).
--
-- PASO 1 se puede correr en cualquier momento. PASO 2 (opcional), recién
-- DESPUÉS de publicar la versión de la app que pide columnas explícitas de
-- resenas (si se corre antes, la ficha deja de mostrar reseñas).
-- =====================================================================


-- ─── PASO 1: huella de IP + una reseña por IP y comercio ───────────────

ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS ip_hash text;

-- Clave secreta para la huella. Nadie la puede leer desde la app.
CREATE TABLE IF NOT EXISTS public.ajustes_privados (
  clave text PRIMARY KEY,
  valor text NOT NULL
);
ALTER TABLE public.ajustes_privados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ajustes_privados FROM anon, authenticated;
INSERT INTO public.ajustes_privados (clave, valor)
VALUES ('sal_ip_resenas', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (clave) DO NOTHING;

-- IP de quien hace la petición: primero cf-connecting-ip (la pone el proxy
-- y no la puede inventar el navegador); si no está, la primera de
-- x-forwarded-for (lo que usa la guía de Supabase). Fuera de una petición de
-- la API (por ejemplo, desde el SQL Editor) devuelve NULL.
CREATE OR REPLACE FUNCTION public.ip_de_la_peticion()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  encabezados json;
  ip text;
BEGIN
  BEGIN
    encabezados := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF encabezados IS NULL THEN
    RETURN NULL;
  END IF;
  ip := coalesce(
    nullif(trim(encabezados->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(encabezados->>'x-forwarded-for', ',', 1)), ''),
    nullif(trim(encabezados->>'x-real-ip'), '')
  );
  RETURN ip;
END;
$$;

CREATE OR REPLACE FUNCTION public.resenas_huella_ip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ip text;
  sal text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.ip_hash := OLD.ip_hash; -- la huella no se puede cambiar
    RETURN NEW;
  END IF;
  ip := public.ip_de_la_peticion();
  IF ip IS NULL THEN
    NEW.ip_hash := NULL; -- reseña cargada a mano: sin límite
    RETURN NEW;
  END IF;
  SELECT valor INTO sal FROM public.ajustes_privados WHERE clave = 'sal_ip_resenas';
  NEW.ip_hash := encode(sha256(convert_to(coalesce(sal, '') || '|' || ip, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resenas_huella_ip() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS resenas_huella_ip ON public.resenas;
CREATE TRIGGER resenas_huella_ip
  BEFORE INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION public.resenas_huella_ip();

-- El límite: una reseña por comercio y por huella de IP. Si alguien
-- intenta otra, la base responde 23505 y la app muestra "Ya dejaste una
-- reseña para este comercio".
CREATE UNIQUE INDEX IF NOT EXISTS resenas_una_por_ip_y_comercio
  ON public.resenas (comercio_id, ip_hash)
  WHERE ip_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ─── PASO 2 (opcional, después de publicar la app): ocultar la huella ──
-- Sin sesión y con sesión se pueden leer todas las columnas de resenas
-- menos ip_hash. La app ya pide columnas explícitas (src/lib/resenas.ts,
-- COLUMNAS_RESENA). Para deshacer: GRANT SELECT ON public.resenas TO anon, authenticated;
/* ← para aplicar: borrar esta línea y la de cierre
DO $$
DECLARE
  columnas text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO columnas
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'resenas' AND column_name <> 'ip_hash';
  EXECUTE 'REVOKE SELECT ON public.resenas FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.resenas TO anon, authenticated', columnas);
END $$;
NOTIFY pgrst, 'reload schema';
*/

-- Comprobación (solo lee): reseñas con y sin huella
SELECT count(*) FILTER (WHERE ip_hash IS NOT NULL) AS con_huella, count(*) AS total FROM public.resenas;
