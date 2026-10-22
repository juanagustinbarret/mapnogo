-- =====================================================================
-- Alertas del SMN para el widget del clima (22/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes y en orden.
--
-- Contexto: el SMN publica sus alertas como un feed con un XML CAP por área
-- (https://ssl.smn.gob.ar/CAP/AR.php) y corta con 429 si se le piden muchos
-- XML seguidos. Por eso la Edge Function alertas-smn (cron cada 10 minutos)
-- baja solo los XML nuevos, de a uno, y guarda acá cuáles tocan a Nogoyá.
-- /api/alertas (Vercel) lee estas tablas con la anon key.
-- Todo es ADITIVO: no borra ni cambia datos existentes.
-- =====================================================================

-- ─── PARTE 1: tablas ───────────────────────────────────────────────────

-- Un registro por XML CAP leído (cada archivo del SMN no cambia: se lee una sola vez)
CREATE TABLE IF NOT EXISTS public.alertas_smn_xml (
  url        text PRIMARY KEY,
  leido_at   timestamptz NOT NULL DEFAULT now(),
  en_nogoya  boolean NOT NULL,          -- el polígono contiene a Nogoyá
  alerta     jsonb                      -- {fenomeno, nivel, inicio, fin, descripcion, rafagas?} si en_nogoya
);

-- Una sola fila: cómo terminó la última vuelta del cron
CREATE TABLE IF NOT EXISTS public.alertas_smn_estado (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  actualizado_at timestamptz NOT NULL,
  completo       boolean NOT NULL,      -- leyó todos los XML de la lista
  pendientes     integer NOT NULL DEFAULT 0,
  error          text
);

-- ─── PARTE 2: permisos ─────────────────────────────────────────────────
-- Lectura pública (son datos públicos del SMN); escribe solo la función
-- (service role, que no pasa por RLS).
ALTER TABLE public.alertas_smn_xml    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_smn_estado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alertas_smn_xml lectura" ON public.alertas_smn_xml;
CREATE POLICY "alertas_smn_xml lectura" ON public.alertas_smn_xml FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "alertas_smn_estado lectura" ON public.alertas_smn_estado;
CREATE POLICY "alertas_smn_estado lectura" ON public.alertas_smn_estado FOR SELECT TO anon, authenticated USING (true);

-- ─── PARTE 3: cron cada 10 minutos ─────────────────────────────────────
-- Antes:
--   1. Extensiones pg_cron y pg_net (Database → Extensions).
--   2. Secreto CRON_SECRET en Edge Functions → Secrets, y el mismo valor en
--      Vault (si ya existe por los otros crons, se reusa):
--        SELECT vault.create_secret('<el CRON_SECRET>', 'cron_secret');
--   3. Desplegar la función SIN verificación de JWT (el cron no manda token;
--      la protege x-cron-secret):
--        supabase functions deploy alertas-smn --no-verify-jwt
-- Reemplazar <REF> por el id del proyecto (graipurciaipsoonmtqk).

SELECT cron.schedule('alertas-smn', '3-59/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/alertas-smn',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Para ver cómo va:  SELECT * FROM public.alertas_smn_estado;
--                    SELECT url, en_nogoya, alerta FROM public.alertas_smn_xml WHERE en_nogoya;
-- Respuestas del cron: SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;
-- Para sacarlo:      SELECT cron.unschedule('alertas-smn');
