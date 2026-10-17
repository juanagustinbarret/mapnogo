import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

serve(async () => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneAccountId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    const hoy = new Date();
    const enDosDias = new Date();
    enDosDias.setDate(hoy.getDate() + 2);
    const fechaTargetStr = enDosDias.toISOString().split('T')[0];

    const { data: suscripciones } = await supabaseAdmin
      .from('suscripciones')
      .select('id, precio_acordado, comercios(nombre, whatsapp)')
      .eq('estado', 'activa')
      .eq('proximo_vencimiento', fechaTargetStr);

    const envios = [];

    for (const sub of suscripciones || []) {
      const comercio = (sub as any).comercios;
      if (!comercio?.whatsapp) continue;

      const mensaje = `Hola, recordamos que el día 10 vence la suscripción de ${comercio.nombre} por ARS $${sub.precio_acordado}. ¡Gracias!`;

      if (whatsappToken && phoneAccountId) {
        await fetch(`https://graph.facebook.com/v18.0/${phoneAccountId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `549${comercio.whatsapp.replace(/\D/g, '')}`,
            type: 'text',
            text: { body: mensaje },
          }),
        });
        envios.push({ comercio: comercio.nombre, status: 'enviado' });
      } else {
        envios.push({ comercio: comercio.nombre, status: 'simulado' });
      }
    }

    return new Response(JSON.stringify({ success: true, envios }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});