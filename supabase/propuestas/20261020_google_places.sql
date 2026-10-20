-- =====================================================================
-- Vincular comercios con su ficha de Google (20/10/2026)
-- =====================================================================
--
-- NO SE EJECUTÓ. Para correr a mano en Supabase → SQL Editor.
-- Solo AGREGA columnas (no borra ni renombra nada) y se puede correr dos
-- veces sin problema.
--
-- Qué se guarda y por qué solo esto: los términos de Google permiten
-- guardar el place_id sin límite de tiempo
-- (developers.google.com/maps/documentation/places/web-service/policies,
-- "Exceptions from caching restrictions"). El puntaje, la cantidad y el
-- texto de las reseñas NO se pueden guardar ni cachear: se piden a Google
-- cada vez que alguien toca "Ver reseñas" en la ficha.
--
-- Orden: se puede correr antes o después de publicar la versión nueva. Sin
-- estas columnas la app funciona igual: todos los comercios figuran como
-- "No vinculado" y la ficha muestra solo las reseñas de NOGOMAP.
-- =====================================================================

ALTER TABLE public.comercios
  ADD COLUMN IF NOT EXISTS google_place_id     text,
  ADD COLUMN IF NOT EXISTS google_estado       text NOT NULL DEFAULT 'no_vinculado',
  ADD COLUMN IF NOT EXISTS google_vinculado_en timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comercios_google_estado_valido') THEN
    ALTER TABLE public.comercios ADD CONSTRAINT comercios_google_estado_valido
      CHECK (google_estado IN ('no_vinculado', 'vinculado', 'sin_ficha'));
  END IF;
  -- place_id con forma válida (letras, números, _ y -)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comercios_google_place_id_valido') THEN
    ALTER TABLE public.comercios ADD CONSTRAINT comercios_google_place_id_valido
      CHECK (google_place_id IS NULL OR (google_place_id ~ '^[A-Za-z0-9_-]+$' AND char_length(google_place_id) BETWEEN 10 AND 300));
  END IF;
END $$;

-- Un lugar de Google no puede quedar vinculado a dos comercios
CREATE UNIQUE INDEX IF NOT EXISTS comercios_google_place_id_unico
  ON public.comercios (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Lectura pública de las columnas nuevas: la función /api/google lee el
-- place_id con la clave pública. Hace falta sobre todo si ya se corrió
-- 20261020_emails_privados.sql (que da permisos columna por columna).
GRANT SELECT (google_place_id, google_estado) ON public.comercios TO anon, authenticated;

-- Las ediciones las hace el admin con las políticas que ya tiene comercios
-- ("Admin gestiona comercios"); no hace falta una política nueva.

NOTIFY pgrst, 'reload schema';

-- Comprobación (solo lee)
SELECT google_estado, count(*) FROM public.comercios GROUP BY 1;
