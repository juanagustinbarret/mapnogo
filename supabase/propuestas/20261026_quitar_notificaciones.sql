-- =====================================================================
-- Quitar las notificaciones push de ofertas (26/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes y en orden, solo si se decide borrar
-- los datos. El código ya no usa nada de esto: dejarlo no rompe nada.
--
-- Antes, fuera del SQL:
--   supabase functions delete notificar-promociones
--   y borrar los secretos VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--   LIMITE_DIARIO_POR_COMERCIO, LIMITE_DIARIO_TOTAL y ANTIGUEDAD_MAXIMA_HORAS.
--   CRON_SECRET y el secreto de Vault 'cron_secret' se quedan: los usan las
--   alertas del SMN y los recordatorios de WhatsApp.
-- =====================================================================

-- ─── PARTE 1: revisar qué existe (solo lectura) ────────────────────────
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'notificar-promociones';
SELECT to_regclass('public.push_subscriptions') AS push_subscriptions,
       to_regclass('public.notificaciones_envios') AS notificaciones_envios;
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'promociones'
   AND column_name IN ('notificada_at', 'notificacion_estado');

-- ─── PARTE 2: dejar de llamar a la función (si la parte 1 mostró el cron) ─
-- SELECT cron.unschedule('notificar-promociones');

-- ─── PARTE 3: borrar los datos (irreversible) ──────────────────────────
-- DROP TABLE IF EXISTS public.notificaciones_envios;
-- DROP TABLE IF EXISTS public.push_subscriptions;
-- DROP INDEX IF EXISTS public.promociones_pendientes_de_aviso;
-- ALTER TABLE public.promociones DROP COLUMN IF EXISTS notificada_at;
-- ALTER TABLE public.promociones DROP COLUMN IF EXISTS notificacion_estado;
-- NOTIFY pgrst, 'reload schema';
