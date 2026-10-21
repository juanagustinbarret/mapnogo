-- =====================================================================
-- Cambio de nombre en textos guardados en la base: NOGOMAP → NOGOYORK
-- (21/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor.
--
-- El código ya dice NOGOYORK. Lo que queda en la base son los mensajes de
-- WhatsApp guardados (configuracion_sistema): sin este cambio, los avisos
-- de vencimiento y de pago seguirían diciendo "NOGOMAP".
--
-- Reemplaza NOGOMAP (en cualquier combinación de mayúsculas y minúsculas)
-- por NOGOYORK. NO toca direcciones web (no reemplaza si viene pegado a un
-- punto o a otras letras, por ejemplo mapnogo.vercel.app).
-- =====================================================================

-- 1. Ver qué hay antes de cambiar nada (solo lectura)
SELECT clave, valor
FROM public.configuracion_sistema
WHERE valor::text ~* 'nogomap';

-- Otros textos que podrían mencionar la marca (solo lectura). Si aparece
-- algo, decidir caso por caso: lo escribió el comercio.
SELECT 'comercios' AS tabla, id::text, nombre AS detalle
FROM public.comercios
WHERE concat_ws(' ', nombre, descripcion_corta, descripcion_completa) ~* 'nogomap'
UNION ALL
SELECT 'promociones', id::text, titulo
FROM public.promociones
WHERE concat_ws(' ', titulo, descripcion) ~* 'nogomap';

-- 2. Reemplazo en los mensajes guardados (en una transacción)
BEGIN;

UPDATE public.configuracion_sistema
SET valor = regexp_replace(
              valor::text,
              '(?<![.[:alnum:]])[Nn][Oo][Gg][Oo][Mm][Aa][Pp](?![.[:alnum:]])',
              'NOGOYORK',
              'g'
            )::jsonb,
    updated_at = now()
WHERE valor::text ~* 'nogomap';

-- Revisar el resultado y recién ahí confirmar:
SELECT clave, valor FROM public.configuracion_sistema WHERE valor::text ~* 'nogo(map|york)';
-- COMMIT;   -- o ROLLBACK; si algo no quedó bien
