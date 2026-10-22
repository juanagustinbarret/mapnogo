# Notificaciones de ofertas (Web Push)

## Por qué no llegaban

El navegador del vecino se suscribía y la suscripción se guardaba en `push_subscriptions`, pero **no existía el envío**: ningún código mandaba la notificación al publicar una oferta (`src/lib/pushNotifications.ts` lo decía: "el envío lo tiene que hacer el servidor… todavía no existe en el repo"). Ahora lo hace la Edge Function `notificar-promociones`.

## Cómo funciona

1. El comercio publica una oferta o novedad en su panel.
2. El panel le pide a `notificar-promociones` que avise. La función decide si corresponde y manda la notificación a todos los dispositivos suscriptos, **esperando** cada envío antes de responder.
3. Un cron cada 5 minutos llama a la misma función: así salen las publicaciones que empiezan en una fecha futura y las que no se pudieron mandar al publicar.

Regla (en `supabase/functions/notificar-promociones/logica.ts`):

- Se avisa **una vez** por publicación (`promociones.notificada_at`). Editarla no la vuelve a mandar.
- Solo si está aprobada, vigente hoy (hora de Argentina) y el comercio es público.
- Si empieza otro día, se avisa ese día.
- Si pasaron más de 72 h y nunca se avisó, ya no se avisa.
- **Límite anti-spam:** 1 aviso por comercio por día y 10 en total por día. Las publicaciones que se pasan del límite se publican igual, pero sin aviso.
- Las suscripciones vencidas (respuestas 404 o 410) se borran solas.
- Cada envío queda registrado en `notificaciones_envios`: destinatarios, enviadas, fallidas, borradas y el motivo de cada falla.

## Qué hay que configurar (una vez)

1. **SQL:** correr `supabase/propuestas/20261021_notificaciones_promociones.sql`.
   - La parte 1 es obligatoria.
   - La parte 2 sirve para revisar `push_subscriptions`.
   - La parte 3 programa el cron.
2. **Claves VAPID.** Hace falta la clave **privada** que corresponde a la pública que usa la app (`VITE_VAPID_PUBLIC_KEY` en Vercel, o el respaldo `BFjU2t…` en `src/lib/pushNotifications.ts`). Si no la tienen, generen un par nuevo con `node scripts/generar-claves-vapid.mjs` y pongan la pública en Vercel. Los dispositivos ya suscriptos van a tener que volver a tocar "Recibir Ofertas".
3. **Secretos de la función** (Supabase → Edge Functions → Secrets):
   - `VAPID_PUBLIC_KEY`: la misma que la app.
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`: por ejemplo `mailto:admin@tudominio.com`.
   - `CRON_SECRET`: si ya existe para los recordatorios, es el mismo.
   - Opcionales: `LIMITE_DIARIO_POR_COMERCIO` (1), `LIMITE_DIARIO_TOTAL` (10), `ANTIGUEDAD_MAXIMA_HORAS` (72).
4. **Desplegar la función:** `supabase functions deploy notificar-promociones`.

## Cómo probarlo sin molestar a nadie

1. Entrá como admin desde el celular. En iPhone, abrí NOGOYORK desde el ícono de la pantalla de inicio.
2. Andá a **Configuración → Notificaciones de ofertas → "Enviarme una notificación de prueba"**. Le llega **solo a ese dispositivo**: la función lo busca por su `endpoint` y no lo manda a nadie más.
3. Si llega, el circuito completo funciona: claves, cifrado, servicio push y service worker.
4. Para ver qué pasaría con las publicaciones pendientes sin mandar nada, llamá a la función con `{"modo":"simulacion"}` como admin.
5. Revisá los logs: Supabase → Edge Functions → notificar-promociones → Logs. Ahí aparecen `promo_notificada`, `promo_omitida` y `claves_vapid_rechazadas`.

## Problemas comunes

- **`claves_vapid_rechazadas` (403):** la privada no corresponde a la pública con la que se suscribieron los dispositivos.
- **No llega en iPhone:** iOS solo admite notificaciones con la app agregada a la pantalla de inicio (iOS 16.4 o posterior).
- **No llega en Brave:** hay que activar "Usar los servicios de Google para mensajería push".
