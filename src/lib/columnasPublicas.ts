// src/lib/columnasPublicas.ts
//
// Columnas de `comercios` que necesitan las páginas públicas (inicio, mapa,
// ficha, farmacia de turno). Antes se pedía `select('*')` y la respuesta
// pública traía el email de cada comercio, que no se muestra en ningún lado
// y la Política de privacidad dice que no se publica.
//
// Si la base todavía no tiene alguna de estas columnas (por ejemplo las de
// delivery, que son de una migración propuesta), la consulta da error: en ese
// caso las páginas vuelven a pedir '*' para no quedarse sin comercios.
// Para que el email deje de ser accesible del todo hay que cerrar también la
// columna en la base (ver supabase/propuestas/20261020_emails_privados.sql).

export const COLUMNAS_PUBLICAS_COMERCIO = [
  'id',
  'nombre',
  'slug',
  'descripcion_corta',
  'descripcion_completa',
  'rubro_id',
  'direccion',
  'latitud',
  'longitud',
  'telefono',
  'whatsapp',
  'sitio_web',
  'instagram',
  'facebook',
  'logo_url',
  'galeria_urls',
  'servicios',
  'medios_pago',
  'aprobado',
  'habilitado_admin',
  'propietario_id', // la ficha lo usa para no contar las visitas del propio dueño
  'created_at',
  'updated_at',
  'tiene_delivery',
  'delivery_pausado_hasta',
].join(', ');

/**
 * Para los listados (inicio, mapa, ofertas): lo mismo SIN las fotos de la
 * galería ni la descripción larga, que solo usa la ficha. Las fotos viejas se
 * guardaban como texto (base64) dentro de la fila: con 6 fotos, cada comercio
 * sumaba ~600 KB a la carga del inicio aunque no se mostraban.
 */
export const COLUMNAS_LISTADO_COMERCIO = COLUMNAS_PUBLICAS_COMERCIO.split(', ')
  .filter((c) => c !== 'galeria_urls' && c !== 'descripcion_completa')
  .join(', ');

