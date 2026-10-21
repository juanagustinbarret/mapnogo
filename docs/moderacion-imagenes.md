# Fotos de comercios: validación y moderación

## Cómo era

Las fotos de la galería se achicaban en el navegador y se guardaban como texto (base64) dentro de `comercios.galeria_urls`. Esto tenía cuatro problemas:

- **Sin control en el servidor.** Cualquiera con la consola del navegador podía guardar cualquier cosa ahí.
- **Enlaces externos sin revisar.** Se podía pegar un link a una imagen de otro sitio, que además puede cambiar después.
- **Sin forma de reportar.** El público no tenía cómo avisar de una foto inapropiada.
- **Mucho peso.** El inicio descargaba las fotos de todos los comercios aunque no las mostraba. En la simulación, 30 comercios con 6 fotos cada uno suman 19,4 MB en la carga del inicio.

## Cómo queda (defensa por capas)

| Capa | Dónde | Qué hace |
|---|---|---|
| 1. Recodificar | Navegador (`src/lib/fotosComercio.ts`) | Achica la foto a 1600 px como máximo y la vuelve a generar como WebP, lo que borra los metadatos. Es solo una ayuda, porque se puede saltear. |
| 2. Validar y limpiar | Servidor (`supabase/functions/_shared/imagenes.ts`) | Mira el tipo **real** del archivo por su firma: solo acepta JPG, PNG y WebP; rechaza SVG, GIF y ejecutables renombrados. Exige hasta 3 MB y entre 100 y 4096 px de lado. Rearma el archivo sin EXIF/GPS, XMP, comentarios ni nada pegado al final. |
| 3. Moderar antes de publicar | Servidor (`_shared/moderacion.ts`) | Si es claramente explícita, se rechaza con un mensaje claro y no se guarda. Si es dudosa, queda "en revisión" y no se ve hasta que un admin la apruebe. Si el moderador falla o no hay ninguno configurado, también queda en revisión: nunca se publica sin revisar. |
| 4. Reportar y cola de revisión | Ficha → "Reportar foto"; Admin → Moderación | El reporte guarda el motivo y una huella cifrada de la conexión, no la IP. Solo se puede reportar la misma foto una vez por conexión, con un máximo de 5 reportes por hora. |
| 5. Límites | Servidor | 20 subidas por usuario por hora y 6 fotos por comercio. Ambos se pueden cambiar. |

Solo la Edge Function `imagenes-comercio` puede escribir el bucket `fotos-comercios` y la tabla `fotos_comercio`. El navegador no tiene ningún permiso de escritura sobre ellos.

**Nota honesta:** el servidor no recodifica los píxeles, porque para eso hace falta una librería de imágenes. Lo que hace es rearmar el archivo dejando solo lo necesario para dibujarlo. Si en algún momento quieren una recodificación completa en el servidor, se puede agregar una librería (por ejemplo `imagescript`) en la función.

## Proveedor de moderación automática: comparación (precios vigentes a octubre de 2026)

| Opción | Precisión para desnudos | Costo | Latencia | Privacidad |
|---|---|---|---|---|
| **OpenAI `omni-moderation-latest`** | Buena: puntajes por categoría (sexual, violencia gráfica, autolesión) | **Gratis**; necesita una clave de API | ~0,5–1,5 s | La imagen va a OpenAI (EE. UU.); según su política, los datos de la API no se usan para entrenar |
| Google Cloud Vision SafeSearch | Muy buena: niveles para adult, racy y violence | 1.000 por mes gratis, después USD 1,50 cada 1.000; exige tarjeta en Google Cloud | ~0,5–1 s | La imagen va a Google |
| Amazon Rekognition | Muy buena, con categorías detalladas | USD 1 cada 1.000; gratis solo 1.000 por mes durante los primeros 12 meses | ~0,5–1 s | La imagen va a AWS |
| Sightengine | Muy buena | 2.000 por mes gratis (máximo 500 por día); USD 29 por mes por 10.000 | ~0,5 s | La imagen va a Sightengine (Francia) |
| Modelo local en el navegador (NSFWJS) | Media | Gratis | Rápida | No sale del dispositivo, **pero se puede saltear** |
| Sin proveedor (revisión manual) | Depende del admin | Gratis | Hasta que un admin la revise | Ninguna imagen sale del sistema |

**Volumen estimado para Nogoyá:** entre 50 y 150 comercios, unas 300 a 1.500 fotos por mes. Con OpenAI el costo es **USD 0**. Con Google sería de USD 0 a 1 por mes y con Rekognition de USD 0 a 1,50 por mes.

**Recomendación: OpenAI `omni-moderation-latest`.** Es gratis, la precisión alcanza para este caso, devuelve puntajes que permiten separar lo "dudoso" de lo "claramente explícito", y la integración ya está hecha. Las fotos son de comercios y se van a publicar igual, así que el riesgo de privacidad es bajo. Como alternativa está Google SafeSearch, también ya integrado: se cambia con un solo secreto.

**No configuré ninguna clave.** Mientras no se configure, todas las fotos nuevas quedan en revisión manual, lo que es seguro y gratis. Para activar la moderación automática:

- `MODERACION_PROVEEDOR=openai` y `OPENAI_API_KEY=…`, o bien
- `MODERACION_PROVEEDOR=google` y `GOOGLE_VISION_API_KEY=…`

Las dos van en Supabase → Edge Functions → Secrets.

## Puesta en marcha (en este orden)

1. `supabase functions deploy imagenes-comercio`
2. SQL `supabase/propuestas/20261021_moderacion_imagenes.sql`, parte 1. Desde ese momento el panel usa la galería nueva; antes de eso sigue con la anterior.
3. Opcional: el secreto del proveedor de moderación.
4. Parte 3 del SQL (el trigger que impide al dueño cambiar datos de administración). Conviene correrla después de probar que la galería nueva funciona.

Las fotos ya guardadas en `galeria_urls` se siguen viendo y se pueden reportar. Para quitarlas, el admin las edita desde Dashboard → Editar comercio.

## Tip general para filtrar imágenes

Nunca confíes en lo que manda el navegador. Revisá el tipo real del archivo por su firma, limitá el peso y las medidas, y regenerá o limpiá la imagen en el servidor para borrar metadatos y contenido escondido. Después pasala por un moderador automático **antes** de publicarla, con dos umbrales: rechazar lo claramente explícito y mandar lo dudoso a revisión humana. Si el moderador falla, que la foto no se publique. Sumá un botón de "Reportar" con una cola de revisión, y límites por usuario y por hora para que nadie pueda inundar el sistema. Un filtro solo en el navegador ayuda, pero no protege, porque se puede saltear.
