-- =====================================================================
-- Auditoría de seguridad de lo creado directo en Supabase (19/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Correr a mano en
-- Supabase → SQL Editor, por partes.
--
-- Contexto: las tablas farmacias_turno, resenas, reportes_comercio, pagos,
-- interacciones_ofertas y las funciones admin_cambiar_password_comercio,
-- registrar_pago_comercio, editar_pago_comercio y eliminar_pago_comercio
-- se crearon desde el SQL Editor y NO están en el repositorio. Desde el
-- código no se puede saber si están bien protegidas. Este archivo:
--   PARTE 1: solo lee y muestra cómo están (no cambia nada).
--   PARTE 2: endurecimientos sugeridos, para correr según lo que muestre la
--            parte 1.
-- =====================================================================

-- ─── PARTE 1: SOLO LECTURA ────────────────────────────────────────────

-- 1.a Funciones: ¿son SECURITY DEFINER? ¿verifican que quien llama es admin?
--     Buscar en la definición algo como "rol = 'admin'" y auth.uid().
SELECT p.proname,
       p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS devuelve,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede_ejecutar,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_cambiar_password_comercio', 'registrar_pago_comercio',
                    'editar_pago_comercio', 'eliminar_pago_comercio');

-- 1.b ¿Las tablas tienen RLS activado?
SELECT relname AS tabla, relrowsecurity AS rls_activado
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('farmacias_turno', 'resenas', 'reportes_comercio', 'pagos',
                  'periodos_suscripcion', 'interacciones_ofertas', 'horarios_delivery');

-- 1.c Políticas de esas tablas
SELECT tablename, policyname, cmd, roles, qual AS usando, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('farmacias_turno', 'resenas', 'reportes_comercio', 'pagos',
                    'periodos_suscripcion', 'interacciones_ofertas', 'horarios_delivery')
ORDER BY tablename, cmd;

-- 1.d Restricciones de resenas (¿estrellas entre 1 y 5? ¿largo máximo?)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.resenas'::regclass;

-- 1.e ¿Existe interacciones_ofertas? (el panel del comercio la consulta)
SELECT to_regclass('public.interacciones_ofertas') AS interacciones_ofertas;

-- Qué buscar en el resultado:
--  - Una función de la lista que sea SECURITY DEFINER y NO verifique
--    "rol = 'admin'" es CRÍTICO: cualquiera con la anon key puede llamarla.
--    Corregir con la PARTE 2.a (o revocarla) antes que nada.
--  - pagos / periodos_suscripcion sin RLS o con SELECT para anon: se ven los
--    cobros de todos.
--  - farmacias_turno con DELETE/INSERT para cualquier usuario autenticado:
--    un comercio podría borrar o asignar turnos de otros.
--  - resenas sin CHECK de estrellas ni largo: se pueden cargar 0, 99 o -1
--    estrellas y textos enormes.

-- ─── PARTE 2: ENDURECIMIENTO SUGERIDO ─────────────────────────────────

-- 2.a admin_cambiar_password_comercio segura. CORRER SOLO si la parte 1.a
--     muestra que la actual no verifica admin. Si la actual devuelve otro
--     tipo que "void", primero: DROP FUNCTION public.admin_cambiar_password_comercio(text, text);
CREATE OR REPLACE FUNCTION public.admin_cambiar_password_comercio(email_target text, nueva_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_dueno uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF nueva_password IS NULL OR length(nueva_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña tiene que tener al menos 6 caracteres';
  END IF;

  SELECT propietario_id INTO v_dueno
  FROM public.comercios
  WHERE lower(email_comercial) = lower(trim(email_target))
  LIMIT 1;

  IF v_dueno IS NULL THEN
    RAISE EXCEPTION 'No hay un comercio con dueño para ese email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_dueno AND rol = 'admin') THEN
    RAISE EXCEPTION 'No se puede cambiar la contraseña de un administrador desde acá';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(nueva_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_dueno;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cambiar_password_comercio(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_password_comercio(text, text) TO authenticated;

-- 2.b Reseñas: estrellas 1..5 y largos razonables (aditivo). Si ya hay
--     filas que no cumplen, el ALTER falla y no cambia nada: revisarlas con
--     SELECT * FROM resenas WHERE estrellas NOT BETWEEN 1 AND 5;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resenas_estrellas_1_a_5') THEN
    ALTER TABLE public.resenas ADD CONSTRAINT resenas_estrellas_1_a_5 CHECK (estrellas BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resenas_largos') THEN
    ALTER TABLE public.resenas ADD CONSTRAINT resenas_largos
      CHECK (char_length(nombre_usuario) BETWEEN 1 AND 60 AND char_length(comentario) BETWEEN 1 AND 1000);
  END IF;
END $$;

-- 2.c Reportes: largo máximo de la descripción
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reportes_descripcion_largo') THEN
    ALTER TABLE public.reportes_comercio ADD CONSTRAINT reportes_descripcion_largo
      CHECK (descripcion IS NULL OR char_length(descripcion) <= 1000);
  END IF;
END $$;

-- 2.d Farmacias de turno: lectura pública; altas/cambios solo admin; el
--     dueño de la farmacia solo puede borrar SUS turnos (botón "Quitar de
--     turno" del panel). Revisar 1.c antes: si ya hay políticas parecidas,
--     borrar las viejas con DROP POLICY "<nombre>" ON public.farmacias_turno;
ALTER TABLE public.farmacias_turno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Turnos visibles" ON public.farmacias_turno;
CREATE POLICY "Turnos visibles" ON public.farmacias_turno FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gestiona turnos" ON public.farmacias_turno;
CREATE POLICY "Admin gestiona turnos" ON public.farmacias_turno FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

DROP POLICY IF EXISTS "Dueño quita sus turnos" ON public.farmacias_turno;
CREATE POLICY "Dueño quita sus turnos" ON public.farmacias_turno FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.comercios c
                 WHERE c.id = farmacias_turno.comercio_id AND c.propietario_id = auth.uid()));
