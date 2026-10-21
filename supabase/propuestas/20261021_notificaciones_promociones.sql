-- =====================================================================
-- Notificaciones push de publicaciones nuevas (21/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes y en orden.
--
-- Contexto: los vecinos se suscriben ("Recibir Ofertas") y la suscripción se
-- guarda en push_subscriptions, pero NADIE mandaba las notificaciones: no
-- existía el envío. Ahora lo hace la Edge Function notificar-promociones.
-- Esto agrega lo que esa función necesita. Todo es ADITIVO: no borra ni
-- cambia datos existentes (salvo marcar como "ya avisadas" las publicaciones
-- que ya existen, para no mandar avisos de todo lo viejo el primer día).
-- =====================================================================

-- ─── PARTE 1: columnas y registro ──────────────────────────────────────

-- 1.a Cuándo se avisó cada publicación (una sola vez) y cómo terminó.
--     El DEFAULT now() marca como "ya avisadas" las publicaciones que ya
--     existen; enseguida se saca el default para que las nuevas queden en NULL.
ALTER TABLE public.promociones ADD COLUMN IF NOT EXISTS notificada_at timestamptz DEFAULT now();
ALTER TABLE public.promociones ALTER COLUMN notificada_at DROP DEFAULT;
ALTER TABLE public.promociones ADD COLUMN IF NOT EXISTS notificacion_estado text;

CREATE INDEX IF NOT EXISTS promociones_pendientes_de_aviso
  ON public.promociones (created_at) WHERE notificada_at IS NULL;

-- 1.b Registro de cada envío (cuántos destinatarios, cuántos llegaron,
--     cuántos fallaron y por qué). Sirve de evidencia y para el límite diario.
CREATE TABLE IF NOT EXISTS public.notificaciones_envios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  modo         text NOT NULL CHECK (modo IN ('promocion', 'prueba')),
  promocion_id uuid REFERENCES public.promociones(id) ON DELETE SET NULL,
  comercio_id  uuid REFERENCES public.comercios(id) ON DELETE SET NULL,
  estado       text NOT NULL,
  destinatarios int NOT NULL DEFAULT 0,
  enviadas     int NOT NULL DEFAULT 0,
  fallidas     int NOT NULL DEFAULT 0,
  borradas     int NOT NULL DEFAULT 0,
  detalle      jsonb
);
CREATE INDEX IF NOT EXISTS notificaciones_envios_por_dia ON public.notificaciones_envios (created_at, comercio_id);

-- Solo la función (clave de servicio) escribe; solo el admin lee.
ALTER TABLE public.notificaciones_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificaciones_envios FROM anon;
DROP POLICY IF EXISTS "Admin lee envios de notificaciones" ON public.notificaciones_envios;
CREATE POLICY "Admin lee envios de notificaciones" ON public.notificaciones_envios
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

NOTIFY pgrst, 'reload schema';

-- ─── PARTE 2: revisar push_subscriptions (se creó a mano) ──────────────

-- 2.a Solo lectura: ¿cómo está protegida hoy?
SELECT relrowsecurity AS rls_activado FROM pg_class WHERE oid = 'public.push_subscriptions'::regclass;
SELECT policyname, cmd, roles, qual AS usando, with_check FROM pg_policies WHERE tablename = 'push_subscriptions';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.push_subscriptions'::regclass;

-- Qué buscar:
--  - Tiene que haber UNIQUE(endpoint): la app hace upsert por endpoint (sin
--    eso, cada "Recibir Ofertas" duplicaría la fila y llegarían avisos dobles).
--  - Ninguna política de SELECT para anon/authenticated: hoy la app no
--    necesita leer la tabla, y si se puede leer, cualquiera con la anon key
--    (que es pública) obtiene los endpoints y claves de todos los vecinos.

-- 2.b Endurecimiento (correr después de mirar 2.a). Deja exactamente lo que
--     usa la app: dar de alta (INSERT) y de baja (DELETE por endpoint). Antes
--     de correrlo, borrar las políticas viejas que muestre 2.a con:
--       DROP POLICY "<nombre>" ON public.push_subscriptions;
--
-- ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.push_subscriptions'::regclass AND contype = 'u') THEN
--     ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unico UNIQUE (endpoint);
--   END IF;
-- END $$;
-- CREATE POLICY "Alta de suscripcion push" ON public.push_subscriptions FOR INSERT TO anon, authenticated
--   WITH CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) < 1000 AND char_length(p256dh) < 200 AND char_length(auth) < 100);
-- CREATE POLICY "Baja de suscripcion push" ON public.push_subscriptions FOR DELETE TO anon, authenticated
--   USING (true);   -- borrar exige conocer el endpoint (largo y al azar)

-- ─── PARTE 3: cron cada 5 minutos ──────────────────────────────────────
-- Saca las publicaciones que empiezan en una fecha futura y las que no se
-- pudieron mandar al publicar. Necesita las extensiones pg_cron y pg_net
-- (Database → Extensions) y el secreto en Vault con el mismo valor que el
-- secreto CRON_SECRET de las Edge Functions:
--   SELECT vault.create_secret('<el CRON_SECRET>', 'cron_secret');
-- Reemplazar <REF> por el id del proyecto (graipurciaipsoonmtqk).
--
-- SELECT cron.schedule(
--   'notificar-promociones',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<REF>.supabase.co/functions/v1/notificar-promociones',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para ver qué pasó: SELECT * FROM public.notificaciones_envios ORDER BY created_at DESC LIMIT 20;
-- Para sacarlo:     SELECT cron.unschedule('notificar-promociones');
