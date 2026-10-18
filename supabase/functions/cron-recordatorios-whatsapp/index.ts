import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

// Fecha de hoy en Argentina (YYYY-MM-DD). toISOString() usa UTC: entre las
// 21:00 y las 23:59 de Argentina ya da el día siguiente.
function fechaArgentina(desplazamientoDias = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const fecha = new Date(`${hoy}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + desplazamientoDias);
  return fecha.toISOString().slice(0, 10);
}

const formatearFecha = (iso: string) => iso.split('-').reverse().join('/');

// Misma lógica que normalizeWhatsAppNumber (src/lib/whatsapp.ts). Antes se
// anteponía "549" siempre, y un número ya cargado como 549... quedaba 549549...
function normalizarWhatsApp(telefono: string): string | null {
  let limpio = (telefono || '').replace(/\D/g, '');
  if (!limpio) return null;
  if (limpio.startsWith('0')) limpio = limpio.substring(1);
  if (limpio.startsWith('549')) {
    // ya está completo
  } else if (limpio.startsWith('54')) limpio = '549' + limpio.substring(2);
  else if (limpio.startsWith('15')) limpio = '5493435' + limpio.substring(2);
  else if (limpio.length >= 6 && limpio.length <= 8) limpio = '5493435' + limpio;
  else limpio = '549' + limpio;
  return limpio.length >= 11 && limpio.length <= 14 ? limpio : null;
}

serve(async (req: Request) => {
  // Sin esta protección cualquiera con la URL (y la anon key, que es pública)
  // podía disparar los envíos las veces que quisiera. Si se define el secreto
  // CRON_SECRET, el cron tiene que mandarlo en el encabezado x-cron-secret.
  const secreto = Deno.env.get('CRON_SECRET');
  if (secreto) {
    if (req.headers.get('x-cron-secret') !== secreto) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
  } else {
    console.warn('CRON_SECRET no está definido: la función se puede invocar sin protección.');
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneAccountId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    const fechaTargetStr = fechaArgentina(2);

    const { data: suscripciones, error: errorConsulta } = await supabaseAdmin
      .from('suscripciones')
      .select('id, precio_acordado, proximo_vencimiento, comercios(nombre, whatsapp)')
      .eq('estado', 'activa')
      .eq('proximo_vencimiento', fechaTargetStr);

    // Antes un error de la consulta se tomaba como "no hay nadie para avisar"
    if (errorConsulta) throw new Error(`No se pudieron leer las suscripciones: ${errorConsulta.message}`);

    const envios = [];

    for (const sub of suscripciones || []) {
      const comercio = (sub as any).comercios;
      const telefono = normalizarWhatsApp(comercio?.whatsapp ?? '');
      if (!telefono) {
        envios.push({ comercio: comercio?.nombre ?? sub.id, status: 'sin_telefono_valido' });
        continue;
      }

      // Antes decía siempre "el día 10", aunque el vencimiento fuera otro.
      const importe = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
        .format(Number(sub.precio_acordado) || 0);
      const mensaje = `Hola, te recordamos que el ${formatearFecha(sub.proximo_vencimiento)} vence la suscripción de ${comercio.nombre} a NOGOMAP por ${importe}. ¡Gracias!`;

      if (whatsappToken && phoneAccountId) {
        const respuesta = await fetch(`https://graph.facebook.com/v18.0/${phoneAccountId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telefono,
            type: 'text',
            text: { body: mensaje },
          }),
        });
        // Antes se marcaba "enviado" aunque Meta rechazara el mensaje.
        if (respuesta.ok) {
          envios.push({ comercio: comercio.nombre, status: 'enviado' });
        } else {
          const detalle = await respuesta.text().catch(() => '');
          console.error('WhatsApp rechazó el mensaje', { comercio: comercio.nombre, status: respuesta.status, detalle });
          envios.push({ comercio: comercio.nombre, status: 'error', codigo: respuesta.status });
        }
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