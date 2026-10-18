-- =====================================================================
-- Renombre de la marca en textos guardados en la base (NOGOMAP, 18/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor.
--
-- Reemplaza "Nogoyá Cerca" y sus variantes (Nogoya Cerca, NOGOYÁ CERCA,
-- NogoyaCerca, nogoya-cerca, nogoya_cerca…) por NOGOMAP en los textos de
-- las plantillas de WhatsApp. NO toca la palabra "Nogoyá" sola (la ciudad)
-- ni direcciones web como www.nogoyacerca.com.ar.
-- =====================================================================

-- 1. Ver qué hay antes de cambiar nada (solo lectura)
SELECT clave, valor
FROM public.configuracion_sistema
WHERE valor::text ~* 'nogoy[aá][[:space:]_-]*cerca';

-- Otros textos que podrían mencionar la marca (solo lectura). Si aparece
-- algo, decidir caso por caso: lo escribió el comercio.
SELECT 'comercios' AS tabla, id::text, nombre AS detalle
FROM public.comercios
WHERE concat_ws(' ', nombre, descripcion_corta) ~* 'nogoy[aá][[:space:]_-]*cerca'
UNION ALL
SELECT 'promociones', id::text, titulo
FROM public.promociones
WHERE concat_ws(' ', titulo, descripcion) ~* 'nogoy[aá][[:space:]_-]*cerca';

-- 2. Reemplazo en las plantillas (en una transacción)
BEGIN;

UPDATE public.configuracion_sistema
SET valor = regexp_replace(
              valor::text,
              -- no reemplaza si viene pegado a "www." o seguido de ".com"
              '(?<![.[:alnum:]])[Nn][Oo][Gg][Oo][Yy][AaÁá][[:space:]_-]*[Cc][Ee][Rr][Cc][Aa](?![.[:alnum:]])',
              'NOGOMAP',
              'g'
            )::jsonb,
    updated_at = now()
WHERE valor::text ~* 'nogoy[aá][[:space:]_-]*cerca';

-- Revisar el resultado y recién ahí confirmar:
SELECT clave, valor FROM public.configuracion_sistema WHERE clave = 'plantillas_whatsapp';
-- COMMIT;   -- o ROLLBACK; si algo no quedó bien
