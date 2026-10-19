import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Configurar CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { email, nuevaPassword } = await req.json()

    if (!email || !nuevaPassword) {
      return new Response(JSON.stringify({ error: 'Faltan datos obligatorios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Instancia con clave maestra
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Buscar el usuario en Auth
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim())

    if (!user) {
      // Si no existe el usuario de Auth, se crea de cero
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password: nuevaPassword,
        email_confirm: true
      })
      if (createError) throw createError

      return new Response(JSON.stringify({ ok: true, mensaje: 'Usuario creado y contraseña asignada' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // 2. Si ya existe, se actualiza la contraseña inmediatamente
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: nuevaPassword
    })

    if (updateError) throw updateError

    return new Response(JSON.stringify({ ok: true, mensaje: 'Contraseña actualizada correctamente' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})