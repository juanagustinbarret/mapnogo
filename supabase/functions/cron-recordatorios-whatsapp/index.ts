import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { hoyArgentina, sumarDias } from '../_shared/fechas.ts';
import { compilarPlantilla, normalizarWhatsApp } from '../_shared/whatsapp.ts';

// Variables de entorno:
//   CRON_SECRET               obligatoria: se compara con el header x-cron-secret
//   WHATSAPP_API_TOKEN        token de la API de WhatsApp Cloud (opcional)
//   WHATSAPP_PHONE_NUMBER_ID  número emisor de WhatsApp Cloud (opcional)
//   WHATSAPP_TEMPLATE_NAME    plantilla aprobada por Meta (recomendado: sin
//                             plantilla, Meta solo entrega mensajes dentro de
//                             las 24 h posteriores a que el comercio escribió)
//   WHATSAPP_TEMPLATE_LANG    idioma de la plantilla (por defecto es_AR)

const PLANTILLA_POR_DEFECTO =
  'Hola, te recordamos que el día 10 vence la suscripción mensual de [NOMBRE DEL COMERCIO] por un importe de [IMPORTE]. ¡Gracias!';

const formatearImporte = (monto: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

const respuesta = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  // 1. Solo lo puede ejecutar quien conoce el secreto (pg_cron o un scheduler)
  const secreto = Deno.env.get('CRON_SECRET');
  if (!secreto || req.headers.get('x-cron-secret') !== secreto) {
    return respuesta({ error: 'No autorizado' }, 401);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const nombrePlantillaMeta = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
    const idiomaPlantillaMeta = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'es_AR';

    // 2. Suscripciones activas que vencen en 2 días (fecha argentina)
    const fechaObjetivo = sumarDias(hoyArgentina(), 2);

    const { data: suscripciones, error } = await supabaseAdmin
      .from('suscripciones')
      .select('id, precio_acordado, comercios!inner(nombre, whatsapp, eliminado_en)')
      .eq('estado', 'activa')
      .eq('proximo_vencimiento', fechaObjetivo)
      .is('comercios.eliminado_en', null);
    if (error) throw error;

    const { data: config } = await supabaseAdmin
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', 'plantillas_whatsapp')
      .maybeSingle();
    const plantilla: string = config?.valor?.proximo_vencimiento || PLANTILLA_POR_DEFECTO;

    const envios: { comercio: string; status: string }[] = [];

    for (const sub of suscripciones ?? []) {
      const comercio = (sub as any).comercios;
      const numero = normalizarWhatsApp(comercio?.whatsapp ?? '');
      if (!numero) {
        envios.push({ comercio: comercio?.nombre ?? '?', status: 'numero_invalido' });
        continue;
      }

      const importe = formatearImporte(Number(sub.precio_acordado));

      if (!token || !phoneId) {
        envios.push({ comercio: comercio.nombre, status: 'simulado' });
        continue;
      }

      const mensaje = nombrePlantillaMeta
        ? {
            type: 'template',
            template: {
              name: nombrePlantillaMeta,
              language: { code: idiomaPlantillaMeta },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: comercio.nombre },
                    { type: 'text', text: importe },
                  ],
                },
              ],
            },
          }
        : {
            type: 'text',
            text: {
              body: compilarPlantilla(plantilla, {
                'NOMBRE DEL COMERCIO': comercio.nombre,
                IMPORTE: importe,
              }),
            },
          };

      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, ...mensaje }),
      });

      envios.push({ comercio: comercio.nombre, status: res.ok ? 'enviado' : `error_${res.status}` });
    }

    return respuesta({ success: true, fecha: fechaObjetivo, envios });
  } catch (err: any) {
    return respuesta({ error: err?.message ?? 'Error desconocido' }, 500);
  }
});
