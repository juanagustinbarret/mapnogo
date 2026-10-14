import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return new Response(JSON.stringify({ error: 'Permisos insuficientes' }), { status: 403, headers: corsHeaders });
    }

    const { email, password, nombreComerciante, datosComercio } = await req.json();

    // 1. Crear usuario en Auth
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreComerciante },
    });

    if (createUserError) throw createUserError;

    // 2. Crear Perfil
    await supabaseAdmin.from('profiles').insert({
      id: newUser.user.id,
      nombre: nombreComerciante,
      rol: 'comerciante',
      estado: 'activo',
    });

    // 3. Crear Comercio
    const { data: nuevoComercio, error: comercioError } = await supabaseAdmin
      .from('comercios')
      .insert({
        ...datosComercio,
        propietario_id: newUser.user.id,
        aprobado: true,
        habilitado_admin: true,
      })
      .select()
      .single();

    if (comercioError) throw comercioError;

    // 4. Crear Suscripción Inicial
    const { data: plan } = await supabaseAdmin.from('planes').select('id, precio_mensual').single();
    const hoy = new Date();
    const vencimiento = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 10);

    await supabaseAdmin.from('suscripciones').insert({
      comercio_id: nuevoComercio.id,
      plan_id: plan.id,
      precio_acordado: plan.precio_mensual,
      estado: 'activa',
      proximo_vencimiento: vencimiento.toISOString().split('T')[0],
    });

    return new Response(
      JSON.stringify({ success: true, comercio: nuevoComercio, userId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});