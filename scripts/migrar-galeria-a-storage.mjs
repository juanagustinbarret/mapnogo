// Pasa las fotos viejas de la galería (guardadas como base64 dentro de
// comercios.galeria_urls) al almacenamiento y a la tabla fotos_comercio.
// Mientras estén en la fila, cada ficha baja la foto entera antes de mostrarla
// (hay una de 4,3 MB) y no se puede cachear.
//
// Uso (desde la carpeta del proyecto, con la clave de servicio en el entorno):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrar-galeria-a-storage.mjs
//     → solo muestra qué haría (no cambia nada)
//   ... node scripts/migrar-galeria-a-storage.mjs --aplicar
//     → sube las fotos, las publica en fotos_comercio y vacía galeria_urls de ese comercio
//
// Las fotos de más de MAX_BYTES no se migran: conviene que el comercio las suba
// de nuevo desde el panel, que las achica a 1600 px en WebP.

const URL_BASE = process.env.SUPABASE_URL;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');
const BUCKET = 'fotos-comercios';
const MAX_BYTES = 1_500_000;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

if (!URL_BASE || !SERVICIO) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const cabeceras = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` };
async function pedir(ruta, init = {}) {
  const r = await fetch(`${URL_BASE}${ruta}`, { ...init, headers: { ...cabeceras, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${ruta.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

const comercios = await pedir(`/rest/v1/comercios?select=id,nombre,galeria_urls&galeria_urls=neq.{}`);
console.log(`${comercios.length} comercio(s) con fotos en galeria_urls${APLICAR ? '' : ' (simulación: agregá --aplicar para migrar)'}\n`);

for (const c of comercios) {
  const fotos = c.galeria_urls ?? [];
  const pendientes = [];
  console.log(`• ${c.nombre}: ${fotos.length} foto(s)`);
  for (const [i, valor] of fotos.entries()) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(String(valor));
    if (!m) {
      console.log(`   ${i + 1}. no es base64 (se deja como está)`);
      pendientes.push(valor);
      continue;
    }
    const bytes = Buffer.from(m[2], 'base64');
    const kb = Math.round(bytes.length / 1024);
    if (bytes.length > MAX_BYTES) {
      console.log(`   ${i + 1}. ${kb} KB: muy pesada, no se migra. Que el comercio la suba de nuevo desde el panel.`);
      pendientes.push(valor);
      continue;
    }
    if (!APLICAR) {
      console.log(`   ${i + 1}. ${kb} KB ${m[1]}: se migraría`);
      pendientes.push(valor);
      continue;
    }
    const id = crypto.randomUUID();
    const ruta = `${c.id}/${id}.${EXT[m[1]]}`;
    await pedir(`/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': m[1], 'x-upsert': 'false', 'cache-control': '31536000' },
      body: bytes,
    });
    await pedir('/rest/v1/fotos_comercio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id, comercio_id: c.id, estado: 'aprobada', motivo: 'migrada:galeria_urls', ruta, url: `${URL_BASE}/storage/v1/object/public/${BUCKET}/${ruta}`, bytes: bytes.length, orden: 100 + i }),
    });
    console.log(`   ${i + 1}. ${kb} KB: migrada`);
  }
  if (APLICAR && pendientes.length !== fotos.length) {
    // Solo quedan en la fila las que no se migraron
    await pedir(`/rest/v1/comercios?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ galeria_urls: pendientes }),
    });
  }
}
