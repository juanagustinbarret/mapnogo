import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cambia la contraseña del dueño de un comercio. SOLO para administradores.
//
// Antes esta función no verificaba quién la llamaba: con la anon key pública
// (que va dentro del sitio) cualquiera podía cambiar la contraseña de
// cualquier usuario, incluidos los admins, o crear usuarios confirmados.
// Ahora:
//   1. Exige la sesión de un usuario cuyo perfil tenga rol 'admin'.
//   2. Solo cambia la contraseña del dueño (propietario_id) de un comercio
//      con ese email comercial; nunca la de un admin.
//   3. No crea usuarios nuevos.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !claveServicio) return responder({ error: 'La función no está configurada.' }, 500)

  const supabaseAdmin = createClient(url, claveServicio, { auth: { persistSession: false } })

  // 1. ¿Quién llama? Tiene que ser un admin con sesión válida.
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return responder({ error: 'Sesión no válida.' }, 401)

  const { data: sesion, error: errorSesion } = await supabaseAdmin.auth.getUser(token)
  if (errorSesion || !sesion?.user) return responder({ error: 'Sesión no válida.' }, 401)

  const { data: perfil } = await supabaseAdmin.from('profiles').select('rol').eq('id', sesion.user.id).maybeSingle()
  if (perfil?.rol !== 'admin') return responder({ error: 'No tenés permisos para cambiar contraseñas.' }, 403)

  // 2. Datos del pedido
  let email = ''
  let nuevaPassword = ''
  try {
    const cuerpo = await req.json()
    email = String(cuerpo?.email ?? '').trim().toLowerCase()
    nuevaPassword = String(cuerpo?.nuevaPassword ?? '')
  } catch {
    return responder({ error: 'Pedido inválido.' }, 400)
  }
  if (!email || !nuevaPassword) return responder({ error: 'Faltan datos obligatorios.' }, 400)
  if (nuevaPassword.length < 8) return responder({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, 400)

  // 3. El usuario a cambiar es el dueño del comercio con ese email comercial
  const { data: comercio, error: errorComercio } = await supabaseAdmin
    .from('comercios')
    .select('id, propietario_id')
    .ilike('email_comercial', email)
    .maybeSingle()
  if (errorComercio) return responder({ error: 'No se pudo buscar el comercio.' }, 500)
  if (!comercio?.propietario_id) return responder({ error: 'No hay un comercio con dueño para ese email.' }, 404)

  const { data: perfilDestino } = await supabaseAdmin
    .from('profiles')
    .select('rol')
    .eq('id', comercio.propietario_id)
    .maybeSingle()
  if (perfilDestino?.rol === 'admin') {
    return responder({ error: 'No se puede cambiar la contraseña de un administrador desde acá.' }, 403)
  }

  const { error: errorCambio } = await supabaseAdmin.auth.admin.updateUserById(comercio.propietario_id, {
    password: nuevaPassword,
  })
  if (errorCambio) {
    console.error('[admin-cambiar-clave]', errorCambio.message)
    return responder({ error: 'No se pudo actualizar la contraseña.' }, 500)
  }

  return responder({ ok: true, mensaje: 'Contraseña actualizada correctamente.' })
})
