-- =====================================================================
-- Revisión de la recuperación de contraseña con tokens (20/10/2026)
-- =====================================================================
--
-- NO SE EJECUTÓ NADA. Es una propuesta para correr a mano en el SQL Editor
-- de Supabase, en orden.
--
-- Contexto: la tabla tokens_recuperacion_password y las funciones
-- admin_cambiar_password_comercio (cambio con token, la usa
-- /reset-password) y admin_cambiar_password_directo (cambio directo desde
-- el panel admin) se crearon desde el SQL Editor y NO están en el
-- repositorio. Desde el código no se puede comprobar que estén bien. La
-- seguridad del sistema depende de 4 cosas que solo se ven en la base:
--
--   1. que nadie salvo un admin pueda INSERTAR tokens (si un comerciante
--      cualquiera puede, puede crear un token para el comercio de otro y
--      cambiarle la contraseña);
--   2. que nadie pueda LEER la tabla de tokens desde la app;
--   3. que el token se guarde con hash (el navegador lo manda en texto: si
--      no hay un trigger que lo convierta, queda legible en la base);
--   4. que admin_cambiar_password_directo verifique que quien llama es admin.
--
-- (La versión vieja admin_cambiar_password_comercio(email_target,
-- nueva_password) no puede seguir existiendo al lado de la nueva: las dos
-- reciben (text, text) y Postgres no permite dos funciones con el mismo
-- nombre y los mismos tipos. Se comprobó en una base de prueba.)
--
-- PARTE 1: solo lee y muestra (no cambia nada). Correrla primero.
-- PARTE 2: arreglos, desactivados entre /* */. Cada uno se corre SOLO si
--          la parte 1 muestra el problema. No tocan la función de cambio con
--          token (2.d explica qué línea cambiar, si hiciera falta).
-- =====================================================================


-- ─── PARTE 1: SOLO LECTURA ────────────────────────────────────────────

-- 1.a Todas las funciones de contraseñas y tokens, con sus parámetros.
--     Mirar:
--       - admin_cambiar_password_comercio tiene que tener (p_nueva_password
--         text, p_token text), que es lo que llama /reset-password;
--       - en las que tengan security_definer = true, que la definición
--         verifique admin (algo como rol = 'admin' con auth.uid()), salvo
--         la de cambio con token, que la llama alguien sin sesión;
--       - anon_puede_ejecutar = true en algo que no sea la de token: CRÍTICO.
SELECT p.proname                                    AS funcion,
       pg_get_function_identity_arguments(p.oid)    AS parametros,
       p.prosecdef                                  AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_puede_ejecutar,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logueado_puede_ejecutar,
       pg_get_functiondef(p.oid)                    AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%password%' OR p.proname ILIKE '%token%' OR p.proname ILIKE '%recuper%')
ORDER BY p.proname, parametros;

-- 1.b Columnas de la tabla de tokens (¿hay columna "usado"/"usado_en"?
--     ¿la columna del token se llama token o token_hash?)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tokens_recuperacion_password'
ORDER BY ordinal_position;

-- 1.c ¿RLS activado? Tiene que dar true en las dos.
SELECT relname AS tabla, relrowsecurity AS rls_activado
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('tokens_recuperacion_password', 'solicitudes_recuperacion');

-- 1.d Políticas. En tokens_recuperacion_password:
--       - NO tiene que haber ninguna de SELECT, UPDATE ni DELETE para anon
--         o authenticated;
--       - la de INSERT (si existe) tiene que exigir admin en with_check.
--     Si hay un INSERT con with_check = true o para todo "authenticated",
--     cualquier comerciante puede crear tokens → parte 2.b.
SELECT tablename, policyname, cmd, roles, qual AS usando, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tokens_recuperacion_password', 'solicitudes_recuperacion')
ORDER BY tablename, cmd;

-- 1.e Triggers de la tabla de tokens. Si "todo queda encriptado", acá
--     tiene que aparecer un trigger BEFORE INSERT que haga digest(...) o
--     crypt(...) del token. Si no aparece ninguno, el token se guarda tal
--     cual lo manda el navegador.
SELECT tgname AS trigger, pg_get_triggerdef(t.oid) AS definicion,
       pg_get_functiondef(t.tgfoid) AS funcion
FROM pg_trigger t
WHERE t.tgrelid = 'public.tokens_recuperacion_password'::regclass
  AND NOT t.tgisinternal;

-- 1.f ¿El token guardado tiene hash? El navegador genera 48 caracteres
--     hexadecimales. Un SHA-256 en hex tiene 64; bcrypt empieza con $2.
--     Si "largo" da 48 y "parece_texto_plano" da true, NO está encriptado.
--     (Solo muestra largos, no muestra los tokens.)
SELECT length(token) AS largo,
       token ~ '^[0-9a-f]{48}$' AS parece_texto_plano,
       count(*) AS cantidad
FROM public.tokens_recuperacion_password
GROUP BY 1, 2;
-- (Si la columna se llama distinto, cambiar "token" por ese nombre.)

-- 1.g Tokens vigentes en este momento (deberían ser pocos o ninguno)
SELECT count(*) FILTER (WHERE expira_en > now()) AS vigentes,
       count(*) AS total,
       max(expira_en - now()) AS el_que_mas_dura
FROM public.tokens_recuperacion_password;


-- ─── PARTE 2: ARREGLOS (solo si la parte 1 muestra el problema) ──────
--
-- Cada arreglo está entre /* y */ a propósito: si se corre el archivo
-- entero, solo se ejecuta la parte 1 (lectura). Para aplicar uno, copiar
-- ese bloque al SQL Editor, borrar la línea "/* ←" y la línea "*/" y
-- correrlo solo.

-- 2.a admin_cambiar_password_directo solo para admins, por permisos. Esto
--     NO reemplaza el control de "rol = 'admin'" adentro de la función (si
--     no lo tiene, cualquiera con sesión puede cambiar contraseñas ajenas:
--     avisar y corregir la función); solo saca a los que no tienen sesión.
/* ← para aplicar: borrar esta línea y la de cierre
REVOKE ALL ON FUNCTION public.admin_cambiar_password_directo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_password_directo(text, text) TO authenticated;
*/

-- 2.b Tabla de tokens: solo un admin puede crear tokens y nadie puede
--     leerlos, cambiarlos ni borrarlos desde la app. La función de cambio
--     con token es SECURITY DEFINER, así que los sigue pudiendo leer y
--     marcar como usados (si no es SECURITY DEFINER, NO correr esto y avisar).
--     Revisar 1.d antes: si hay políticas viejas, borrarlas con
--       DROP POLICY "<nombre>" ON public.tokens_recuperacion_password;
/* ← para aplicar: borrar esta línea y la de cierre
ALTER TABLE public.tokens_recuperacion_password ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, UPDATE, DELETE ON public.tokens_recuperacion_password FROM anon, authenticated;
REVOKE INSERT ON public.tokens_recuperacion_password FROM anon;

DROP POLICY IF EXISTS "tokens: solo admin crea" ON public.tokens_recuperacion_password;
CREATE POLICY "tokens: solo admin crea" ON public.tokens_recuperacion_password
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
*/

-- 2.c Vencimiento decidido por la base, no por el reloj del celular del
--     admin: hoy el navegador calcula "ahora + 15 minutos" con su propio
--     reloj; si el celular está adelantado o atrasado, el link dura de más
--     o de menos (o vence antes de llegar). Este trigger fuerza 15 minutos
--     desde la hora del servidor, pida lo que pida el navegador. No cambia
--     el token ni cómo se valida.
/* ← para aplicar: borrar esta línea y la de cierre
CREATE OR REPLACE FUNCTION public.tokens_recuperacion_vencimiento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.expira_en := now() + interval '15 minutes';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tokens_recuperacion_vencimiento ON public.tokens_recuperacion_password;
CREATE TRIGGER tokens_recuperacion_vencimiento
  BEFORE INSERT ON public.tokens_recuperacion_password
  FOR EACH ROW EXECUTE FUNCTION public.tokens_recuperacion_vencimiento();
*/

-- 2.d SOLO si 1.e/1.f muestran que el token se guarda en TEXTO PLANO.
--     Son DOS cambios que van JUNTOS, en la misma corrida: si se agrega solo
--     el trigger, la función de cambio con token deja de encontrar los
--     tokens y ningún link funciona. Probado en una base de prueba: el token
--     queda guardado como SHA-256 (64 caracteres), el link funciona una vez
--     y el segundo uso da "Token inválido o vencido".
--
--     (1) Trigger: guarda el hash en vez del token (sha256 viene con
--         Postgres, no hace falta ninguna extensión).
-- CREATE OR REPLACE FUNCTION public.tokens_recuperacion_hash()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- BEGIN
--   NEW.token := encode(sha256(convert_to(NEW.token, 'UTF8')), 'hex');
--   RETURN NEW;
-- END;
-- $$;
-- CREATE TRIGGER tokens_recuperacion_hash
--   BEFORE INSERT ON public.tokens_recuperacion_password
--   FOR EACH ROW EXECUTE FUNCTION public.tokens_recuperacion_hash();
--
--     (2) En admin_cambiar_password_comercio (copiar la definición que
--         muestra 1.a y cambiar SOLO la comparación del token): donde dice
--           ... WHERE token = p_token ...
--         poner
--           ... WHERE token = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') ...
--         en TODAS las líneas donde compara el token (también en el UPDATE
--         que lo marca como usado).
--
--     Los tokens vigentes en ese momento dejan de servir (están en texto y la
--     función ahora busca el hash): avisar a quien tenga un link pendiente.

-- 2.e Pedidos de recuperación: hoy la pantalla "Olvidé mi contraseña"
--     consulta la tabla sin sesión para ver si ya hay un pedido pendiente,
--     así que cualquiera puede leer los emails de quienes pidieron
--     recuperar su contraseña. Con esto, sin sesión solo se puede crear un
--     pedido (no leer); el "uno pendiente por email" lo controla la base.
--     Efecto visible: si alguien pide dos veces, ve "No se pudo registrar
--     la solicitud" en vez de "Ya tenés una solicitud pendiente".
--     Revisar 1.d antes: si hay políticas viejas (por ejemplo una que deja
--     leer a anon), borrarlas con
--       DROP POLICY "<nombre>" ON public.solicitudes_recuperacion;
--     Antes de crear el índice, si hay duplicados pendientes, resolverlos:
--       SELECT email, count(*) FROM solicitudes_recuperacion
--       WHERE estado = 'pendiente' GROUP BY 1 HAVING count(*) > 1;
/* ← para aplicar: borrar esta línea y la de cierre
ALTER TABLE public.solicitudes_recuperacion ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, UPDATE, DELETE ON public.solicitudes_recuperacion FROM anon;

DROP POLICY IF EXISTS "solicitudes: cualquiera pide" ON public.solicitudes_recuperacion;
CREATE POLICY "solicitudes: cualquiera pide" ON public.solicitudes_recuperacion
  FOR INSERT TO anon, authenticated
  WITH CHECK (estado = 'pendiente');

DROP POLICY IF EXISTS "solicitudes: admin gestiona" ON public.solicitudes_recuperacion;
CREATE POLICY "solicitudes: admin gestiona" ON public.solicitudes_recuperacion
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_recuperacion_un_pendiente
  ON public.solicitudes_recuperacion (lower(email))
  WHERE estado = 'pendiente';
*/

-- 2.f Un link nuevo anula los anteriores del mismo comercio. Hoy, si el
--     admin genera dos links (por ejemplo uno por mail y otro por
--     WhatsApp), los dos sirven hasta que vencen. CORRER SOLO si 1.b muestra
--     una columna "usado" (boolean); si se llama distinto, cambiar el nombre.
--     Probado: con dos links, el primero da "Token inválido o vencido" y el
--     segundo funciona una vez.
/* ← para aplicar: borrar esta línea y la de cierre
CREATE OR REPLACE FUNCTION public.tokens_recuperacion_anular_previos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tokens_recuperacion_password
  SET usado = true
  WHERE comercio_id = NEW.comercio_id AND NOT usado;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tokens_recuperacion_anular_previos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tokens_recuperacion_anular_previos ON public.tokens_recuperacion_password;
CREATE TRIGGER tokens_recuperacion_anular_previos
  BEFORE INSERT ON public.tokens_recuperacion_password
  FOR EACH ROW EXECUTE FUNCTION public.tokens_recuperacion_anular_previos();
*/
