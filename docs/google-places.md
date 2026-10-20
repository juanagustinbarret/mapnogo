# Reseñas de Google (Places API New)

## Qué hace

- **Ficha del comercio** (`/comercio/{slug}#resenas`): sección "Reseñas" con
  las de Google (al tocar "Ver reseñas de Google") y debajo las de NOGOMAP.
- **Popup del mapa**: muestra el puntaje de las reseñas **de NOGOMAP**, no el
  de Google (ver "Límites de Google").
- **Admin**: vincular cada comercio con su ficha de Google (`place_id`).
- **QR del comercio**: `/n/{slug}/resenas` → ficha en `#resenas`.

## Variables de entorno (servidor)

| Variable | Obligatoria | Para qué |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Sí | Clave de Google. **Solo en el servidor**: nunca con prefijo `VITE_`, nunca en el repo. |
| `GOOGLE_LIMITE_DIARIO` | No (300) | Consultas de reseñas por día y por instancia de la función. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | No | Si no están, usa `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o los valores públicos del sitio. |

- **Vercel**: Settings → Environment Variables → `GOOGLE_PLACES_API_KEY`
  (Production y Preview). Función: `api/google.ts`.
- **Cloudflare Pages**: Settings → Variables and Secrets → tipo *Secret*.
  Función: `functions/api/google.ts`.
- **Desarrollo** (`pnpm dev`): `GOOGLE_PLACES_API_KEY=... pnpm dev`. Sin la
  variable, la ficha muestra "Reseñas de Google no configuradas" y el resto
  funciona.

## Endpoint `/api/google`

- `GET ?accion=resenas&slug={slug}` (público): el servidor busca el
  `place_id` en la base (el navegador no elige qué lugar consultar) y pide a
  Google `rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks`.
  Respuesta `Cache-Control: no-store`.
- `POST ?accion=buscar` `{ texto }` o `{ placeId }` (solo admin, con el token
  de Supabase): hasta 5 candidatos con `id,displayName,formattedAddress,googleMapsUri`.
- Límites: 12 consultas de reseñas por minuto por IP, 20 búsquedas por minuto
  por IP y `GOOGLE_LIMITE_DIARIO` por instancia. **El límite fuerte es la
  cuota de Google Cloud** (abajo): la función puede correr en varias
  instancias y cada una cuenta por separado.

## Límites de Google (con la fuente)

- **Solo se puede guardar el `place_id`.** "You must not pre-fetch, cache, or
  store Places API content beyond the allowed exceptions" y "You can
  therefore store place ID values indefinitely"
  ([Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)).
  Por eso el puntaje y las reseñas no se guardan en la base ni en caché.
- **No se puede mostrar con un mapa que no sea de Google.** "Customer must not
  use Google Maps Content from the Places API in conjunction with a
  non-Google map" ([Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms),
  Places API 14.2). El mapa de NOGOMAP es OpenStreetMap: el popup usa el
  puntaje propio de NOGOMAP. Sí se puede mostrar sin mapa (14.1): la ficha no
  tiene mapa.
- **Máximo 5 reseñas**, "sorted by relevance"
  ([referencia de Place](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)).
- **Atribución**: "Google Maps" visible, autor de cada reseña (foto, nombre y
  link al perfil), acceso a la reseña en Google Maps y un aviso de cómo están
  ordenadas. Si la reseña está traducida, se avisa.

## Costos (precios del 20/10/2026, [tabla de Google](https://developers.google.com/maps/billing-and-pricing/pricing))

| Consulta | SKU | Gratis por mes | Después (cada 1.000) |
|---|---|---|---|
| Reseñas en la ficha (incluye `reviews`) | Place Details Enterprise + Atmosphere | 1.000 | US$ 25 |
| Buscar candidatos (admin) | Text Search Pro | 5.000 | US$ 32 |
| Validar un place_id pegado (admin) | Place Details Pro | 5.000 | US$ 17 |

Cada consulta se cobra al SKU más caro de los campos pedidos.

## Qué configurar en Google Cloud

1. Crear un proyecto y una **cuenta de facturación** (Google la exige aunque
   se use solo lo gratis).
2. **APIs y servicios → Biblioteca → "Places API (New)" → Habilitar.**
3. **Credenciales → Crear clave de API.** Restringirla:
   - *Restricciones de API*: solo **Places API (New)**.
   - *Restricciones de aplicación*: ninguna sirve bien (la función de Vercel
     no tiene IP fija). Por eso la clave **no** va nunca al navegador.
4. **Cuotas** (Places API (New) → Cuotas y límites del sistema): bajar
   "Place Details requests per day" a, por ejemplo, **300** y "Text Search
   requests per day" a **50**. Es el tope real contra abusos.
5. **Facturación → Presupuestos y alertas**: presupuesto de US$ 10 por mes
   con avisos al 50 %, 90 % y 100 %.
6. Cargar la clave en Vercel como `GOOGLE_PLACES_API_KEY` y volver a
   desplegar.

## Crear fichas en Google

No es posible crear fichas verificadas de negocios de terceros desde
NOGOMAP:

- "Only business owners or authorized representatives may verify and manage
  their business information on a Business Profile"
  ([Business eligibility and ownership guidelines](https://support.google.com/business/answer/13763036)).
- La Business Profile API exige un perfil propio "verified and active for 60+
  days" y aprobación de Google
  ([prerequisites](https://developers.google.com/my-business/content/prereqs));
  "Verification options can only be initiated by a direct request from the
  owner of the location" ([policies](https://developers.google.com/my-business/content/policies)).

Lo que hace NOGOMAP: marca el comercio como "Sin ficha en Google", y el botón
"Crear ficha en Google" abre business.google.com/create con los datos listos
para copiar y los pasos para el dueño.
