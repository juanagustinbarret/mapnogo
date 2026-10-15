import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { diezDelMesSiguiente, hoyArgentina } from '../_shared/fechas.ts';

// Campos del comercio que acepta esta función (todo lo demás se ignora)
interface DatosComercio {
  nombre: string;
  rubro_id: string;
  descripcion_corta: string;
  direccion: string;
  whatsapp: string;
  latitud: number;
  longitud: number;
  email_comercial?: string | null;
  telefono?: string | null;
}

const crearSlugBase = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'comercio';

const validar = (body: any): string | null => {
  if (!body || typeof body !== 'object') return 'Cuerpo de la solicitud inválido.';
  const { email, password, nombreComerciante, datosComercio: c } = body;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido.';
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (typeof nombreComerciante !== 'string' || !nombreComerciante.trim()) return 'Falta el nombre del comerciante.';
  if (!c || typeof c !== 'object') return 'Faltan los datos del comercio.';
  for (const campo of ['nombre', 'rubro_id', 'descripcion_corta', 'direccion', 'whatsapp']) {
    if (typeof c[campo] !== 'string' || !c[campo].trim()) return `Falta el campo "${campo}" del comercio.`;
  }
  if (typeof c.latitud !== 'number' || typeof c.longitud !== 'number') return 'Faltan las coordenadas del comercio.';
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Método no permitido' }, 405);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // 1. Verificar que quien llama sea un admin activo
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse(req, { error: 'No autorizado' }, 401);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return jsonResponse(req, { error: 'No autorizado' }, 401);

  const { data: perfilAdmin } = await supabaseAdmin
    .from('profiles')
    .select('rol, estado')
    .eq('id', user.id)
    .maybeSingle();

  if (perfilAdmin?.rol !== 'admin' || perfilAdmin?.estado !== 'activo') {
    return jsonResponse(req, { error: 'Permisos insuficientes' }, 403);
  }

  // 2. Validar datos
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'JSON inválido' }, 400);
  }
  const errorValidacion = validar(body);
  if (errorValidacion) return jsonResponse(req, { error: errorValidacion }, 400);

  const { email, password, nombreComerciante } = body;
  const c: DatosComercio = body.datosComercio;

  let nuevoUsuarioId: string | null = null;
  let nuevoComercioId: string | null = null;

  try {
    // 3. Plan activo (el más económico)
    const { data: plan, error: planError } = await supabaseAdmin
      .from('planes')
      .select('id, precio_mensual')
      .eq('estado', true)
      .order('precio_mensual', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new Error('No hay ningún plan activo configurado.');

    // 4. Slug único
    const base = crearSlugBase(c.nombre);
    const { data: existentes, error: slugError } = await supabaseAdmin
      .from('comercios')
      .select('slug')
      .like('slug', `${base}%`);
    if (slugError) throw slugError;
    const usados = new Set((existentes ?? []).map((e: { slug: string }) => e.slug));
    let slug = base;
    for (let i = 2; usados.has(slug); i++) slug = `${base}-${i}`;

    // 5. Usuario de acceso
    const { data: nuevoUsuario, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreComerciante.trim() },
    });
    if (createUserError) throw createUserError;
    nuevoUsuarioId = nuevoUsuario.user.id;

    // 6. Perfil
    const { error: perfilError } = await supabaseAdmin.from('profiles').upsert({
      id: nuevoUsuarioId,
      nombre: nombreComerciante.trim(),
      rol: 'comerciante',
      estado: 'activo',
    });
    if (perfilError) throw perfilError;

    // 7. Comercio (solo los campos permitidos)
    const { data: comercio, error: comercioError } = await supabaseAdmin
      .from('comercios')
      .insert({
        nombre: c.nombre.trim(),
        slug,
        rubro_id: c.rubro_id,
        descripcion_corta: c.descripcion_corta.trim(),
        direccion: c.direccion.trim(),
        whatsapp: c.whatsapp.trim(),
        latitud: c.latitud,
        longitud: c.longitud,
        email_comercial: c.email_comercial?.trim() || null,
        telefono: c.telefono?.trim() || null,
        propietario_id: nuevoUsuarioId,
        aprobado: true,
        habilitado_admin: true,
      })
      .select()
      .single();
    if (comercioError) throw comercioError;
    nuevoComercioId = comercio.id;

    // 8. Suscripción inicial: vence el día 10 del mes siguiente
    const { error: subError } = await supabaseAdmin.from('suscripciones').insert({
      comercio_id: comercio.id,
      plan_id: plan.id,
      precio_acordado: plan.precio_mensual,
      estado: 'activa',
      proximo_vencimiento: diezDelMesSiguiente(hoyArgentina()),
    });
    if (subError) throw subError;

    return jsonResponse(req, { success: true, comercio, userId: nuevoUsuarioId });
  } catch (error: any) {
    // Deshacer lo creado para no dejar datos a medias
    if (nuevoComercioId) await supabaseAdmin.from('comercios').delete().eq('id', nuevoComercioId);
    if (nuevoUsuarioId) await supabaseAdmin.auth.admin.deleteUser(nuevoUsuarioId);

    const mensaje = String(error?.message ?? 'Error desconocido');
    const yaExiste = /already (been )?registered|already exists/i.test(mensaje);
    return jsonResponse(
      req,
      { error: yaExiste ? 'Ya existe un usuario con ese email.' : mensaje },
      yaExiste ? 409 : 400,
    );
  }
});
