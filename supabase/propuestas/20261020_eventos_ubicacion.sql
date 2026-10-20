-- =====================================================================
-- Eventos: punto exacto en el mapa (20/10/2026)
-- =====================================================================
--
-- NO SE EJECUTÓ. Para correr a mano en Supabase → SQL Editor.
--
-- Por qué: "Cómo llegar" de la ficha del evento buscaba en Google Maps por
-- el nombre del lugar ("Parque Municipal, Nogoyá") y muchas veces llevaba a
-- otro lado. Ahora el admin marca el punto en un mapa al cargar el evento y
-- "Cómo llegar" va a esas coordenadas.
--
-- Es aditivo: agrega dos columnas que pueden quedar vacías. Los eventos que
-- ya existen siguen igual (sin punto, "Cómo llegar" busca por el nombre como
-- antes). No toca permisos: las políticas de la tabla eventos se aplican
-- igual a las columnas nuevas.
--
-- Mientras no se corra, la app funciona: guarda el evento sin el punto y le
-- avisa al admin que falta este paso.
-- =====================================================================

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS latitud  double precision,
  ADD COLUMN IF NOT EXISTS longitud double precision;

-- Las dos juntas o ninguna, y dentro de la Argentina continental (evita
-- puntos en 0,0 o con latitud y longitud invertidas).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eventos_punto_valido') THEN
    ALTER TABLE public.eventos ADD CONSTRAINT eventos_punto_valido CHECK (
      (latitud IS NULL AND longitud IS NULL)
      OR (latitud IS NOT NULL AND longitud IS NOT NULL
          AND latitud BETWEEN -56 AND -21 AND longitud BETWEEN -74 AND -53)
    );
  END IF;
END $$;

-- Para que la API vea las columnas nuevas enseguida
NOTIFY pgrst, 'reload schema';

-- Comprobación (solo lee): tienen que aparecer latitud y longitud
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'eventos' AND column_name IN ('latitud', 'longitud');
