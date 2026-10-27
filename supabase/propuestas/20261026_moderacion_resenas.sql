-- =====================================================================
-- Pedidos de eliminación de reseñas (26/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes y en orden. Después desplegar la
-- función: supabase functions deploy moderar-resenas
--
-- El comercio pide eliminar una reseña de SU comercio con un motivo; el
-- admin aprueba o rechaza desde Moderación. Aprobar no borra la fila: la
-- marca (eliminada_at / eliminada_por) y deja de verse. Todo lo escribe la
-- función moderar-resenas con la clave de servicio; desde el navegador solo
-- se puede leer lo propio.
-- Todo es ADITIVO: no borra ni cambia datos existentes.
-- =====================================================================

-- ─── PARTE 1: reseñas eliminadas (borrado lógico) ──────────────────────
ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS eliminada_at timestamptz;
ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS eliminada_por uuid REFERENCES auth.users(id);

-- Restrictiva: se suma a las políticas que ya tenga la tabla. Ni el público
-- ni los comercios ni el panel leen una reseña eliminada.
DROP POLICY IF EXISTS "Resenas eliminadas ocultas" ON public.resenas;
CREATE POLICY "Resenas eliminadas ocultas" ON public.resenas
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (eliminada_at IS NULL);

-- Que nadie marque o desmarque una reseña desde el navegador (el comercio
-- conserva el UPDATE de su respuesta). Solo la clave de servicio o el SQL Editor.
CREATE OR REPLACE FUNCTION public.proteger_eliminacion_resena()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.eliminada_at IS DISTINCT FROM OLD.eliminada_at OR NEW.eliminada_por IS DISTINCT FROM OLD.eliminada_por)
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS proteger_eliminacion_resena ON public.resenas;
CREATE TRIGGER proteger_eliminacion_resena BEFORE UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_eliminacion_resena();

-- ─── PARTE 2: pedidos de eliminación ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_eliminacion_resena (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  resena_id      uuid NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  comercio_id    uuid NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  solicitado_por uuid NOT NULL REFERENCES auth.users(id),
  motivo         text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 10 AND 500),
  resena_resumen text CHECK (char_length(resena_resumen) <= 300), -- copia: la reseña aprobada deja de leerse
  estado         text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  nota_admin     text CHECK (char_length(nota_admin) <= 500),
  resuelta_por   uuid REFERENCES auth.users(id),
  resuelta_at    timestamptz
);
-- Una sola pendiente por reseña
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_eliminacion_resena_una_pendiente
  ON public.solicitudes_eliminacion_resena (resena_id) WHERE estado = 'pendiente';
-- Para el límite diario por comercio
CREATE INDEX IF NOT EXISTS solicitudes_eliminacion_resena_por_comercio
  ON public.solicitudes_eliminacion_resena (comercio_id, created_at);

ALTER TABLE public.solicitudes_eliminacion_resena ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitudes_eliminacion_resena FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.solicitudes_eliminacion_resena FROM authenticated;
DROP POLICY IF EXISTS "Dueño ve sus pedidos de eliminacion" ON public.solicitudes_eliminacion_resena;
CREATE POLICY "Dueño ve sus pedidos de eliminacion" ON public.solicitudes_eliminacion_resena
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.comercios c WHERE c.id = comercio_id AND c.propietario_id = auth.uid()));
DROP POLICY IF EXISTS "Admin ve los pedidos de eliminacion" ON public.solicitudes_eliminacion_resena;
CREATE POLICY "Admin ve los pedidos de eliminacion" ON public.solicitudes_eliminacion_resena
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

-- ─── PARTE 3: auditoría (quién, qué, cuándo) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria_moderacion_resenas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  solicitud_id uuid REFERENCES public.solicitudes_eliminacion_resena(id) ON DELETE SET NULL,
  resena_id    uuid,
  accion       text NOT NULL CHECK (accion IN ('solicitada', 'aprobada', 'rechazada')),
  actor        uuid NOT NULL REFERENCES auth.users(id),
  detalle      jsonb
);
ALTER TABLE public.auditoria_moderacion_resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_moderacion_resenas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.auditoria_moderacion_resenas FROM authenticated;
DROP POLICY IF EXISTS "Admin lee la auditoria de resenas" ON public.auditoria_moderacion_resenas;
CREATE POLICY "Admin lee la auditoria de resenas" ON public.auditoria_moderacion_resenas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

NOTIFY pgrst, 'reload schema';

-- ─── Para revisar después ──────────────────────────────────────────────
-- Pedidos pendientes:  SELECT * FROM public.solicitudes_eliminacion_resena WHERE estado = 'pendiente';
-- Auditoría:           SELECT * FROM public.auditoria_moderacion_resenas ORDER BY created_at DESC LIMIT 20;
-- Restaurar una reseña eliminada por error (desde el SQL Editor):
--   UPDATE public.resenas SET eliminada_at = NULL, eliminada_por = NULL WHERE id = '<id>';
