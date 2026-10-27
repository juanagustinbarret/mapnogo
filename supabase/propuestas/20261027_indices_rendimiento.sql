-- =====================================================================
-- Índices para las consultas del panel, la ficha y el inicio (27/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr en Supabase → SQL
-- Editor. Solo crea índices (no cambia datos) y usa IF NOT EXISTS: se puede
-- correr más de una vez. Postgres no crea índices solos para las claves
-- foráneas, y varias tablas se crearon a mano (sin índices en el repo).
--
-- CONCURRENTLY no bloquea las tablas mientras se crea el índice, pero no
-- puede ir dentro de una transacción: si el SQL Editor da error, correr cada
-- línea por separado o sacar la palabra CONCURRENTLY (son tablas chicas).
-- =====================================================================

-- ─── PARTE 1: revisar qué índices hay hoy (solo lectura) ───────────────
SELECT tablename, indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename IN ('comercios', 'promociones', 'resenas', 'horarios_atencion', 'horarios_delivery',
                     'interacciones_ofertas', 'farmacias_turno', 'fotos_comercio', 'metricas_interacciones')
 ORDER BY tablename, indexname;

-- ─── PARTE 2: índices ──────────────────────────────────────────────────
-- Panel: "mi comercio" (también lo usan las políticas RLS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS comercios_por_propietario ON public.comercios (propietario_id);
-- Ficha y panel: ofertas de un comercio, vigentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS promociones_por_comercio ON public.promociones (comercio_id, fecha_fin);
-- Ficha y panel: reseñas de un comercio, de la más nueva a la más vieja
CREATE INDEX CONCURRENTLY IF NOT EXISTS resenas_por_comercio ON public.resenas (comercio_id, created_at DESC);
-- Ficha y panel: horarios de un comercio
CREATE INDEX CONCURRENTLY IF NOT EXISTS horarios_atencion_por_comercio ON public.horarios_atencion (comercio_id, dia_semana);
-- Panel: clics por oferta (se cuentan en la base con interacciones_ofertas(count))
CREATE INDEX CONCURRENTLY IF NOT EXISTS interacciones_ofertas_por_promocion ON public.interacciones_ofertas (promocion_id);
-- Inicio: farmacia de turno de hoy; panel: próximo turno del comercio
CREATE INDEX CONCURRENTLY IF NOT EXISTS farmacias_turno_por_fecha ON public.farmacias_turno (fecha);
CREATE INDEX CONCURRENTLY IF NOT EXISTS farmacias_turno_por_comercio ON public.farmacias_turno (comercio_id, fecha);

-- Si todavía no se corrieron las propuestas que los traen (son los mismos nombres):
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_horarios_delivery_comercio ON public.horarios_delivery (comercio_id, dia_semana);
CREATE INDEX CONCURRENTLY IF NOT EXISTS fotos_comercio_por_comercio ON public.fotos_comercio (comercio_id, estado);

-- ─── PARTE 3: la función de visibilidad que usa la política de comercios ─
-- Se evalúa por cada fila. Marcarla STABLE le permite a Postgres no
-- recalcularla de más; fijar search_path es además una buena práctica de
-- seguridad en funciones SECURITY DEFINER. No cambia lo que devuelve.
ALTER FUNCTION public.es_comercio_publico(uuid) STABLE;
ALTER FUNCTION public.es_comercio_publico(uuid) SET search_path = public;

ANALYZE public.comercios, public.promociones, public.resenas, public.horarios_atencion;
