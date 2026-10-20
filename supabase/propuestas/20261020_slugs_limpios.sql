-- supabase/propuestas/20261020_slugs_limpios.sql
--
-- PROPUESTA, NO EJECUTADA. Correr a mano en el SQL Editor de Supabase.
--
-- Para qué: el slug se podía editar a mano en el panel del admin y algún
-- comercio quedó con espacios y mayúsculas ("BIEN CRIOLLO PIZZAS"). Su link y
-- su QR salían con %20 y algunos lectores de QR los mostraban como texto.
--
-- Desde este cambio:
--   * el QR y los links /n/... usan siempre el slug limpio
--     ("bien-criollo-pizzas");
--   * la ficha encuentra el comercio aunque el slug guardado sea el viejo, y
--     los links viejos siguen andando después de corregirlo;
--   * el admin guarda siempre el slug limpio.
-- O sea: NO hace falta correr esto para que funcione. Sirve para dejar la
-- base prolija (y que la búsqueda de la ficha sea de una sola consulta).
--
-- Paso 1 es solo lectura. Paso 2 cambia datos: correrlo después de revisar
-- el resultado del paso 1.

-- ── Paso 1: ver qué cambiaría ──────────────────────────────────────────────
with propuesta as (
  select
    id,
    nombre,
    slug,
    trim(both '-' from regexp_replace(
      translate(lower(slug), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g'
    )) as slug_nuevo
  from public.comercios
)
select
  p.nombre,
  p.slug as slug_actual,
  p.slug_nuevo,
  exists (select 1 from public.comercios o where o.slug = p.slug_nuevo and o.id <> p.id) as ya_lo_usa_otro
from propuesta p
where p.slug_nuevo <> p.slug
order by p.nombre;

-- ── Paso 2: corregir (solo los que no chocan con otro comercio) ────────────
-- Si el paso 1 marcó alguno con ya_lo_usa_otro = true, ese queda como está:
-- corregilo a mano desde el panel del admin eligiendo otro slug.
--
-- begin;
-- with propuesta as (
--   select
--     id,
--     slug,
--     trim(both '-' from regexp_replace(
--       translate(lower(slug), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
--       '[^a-z0-9]+', '-', 'g'
--     )) as slug_nuevo
--   from public.comercios
-- ),
-- elegidos as (
--   select p.id, p.slug_nuevo,
--          row_number() over (partition by p.slug_nuevo order by p.id) as orden
--   from propuesta p
--   where p.slug_nuevo <> p.slug
--     and p.slug_nuevo <> ''
--     and not exists (select 1 from public.comercios o where o.slug = p.slug_nuevo and o.id <> p.id)
-- )
-- update public.comercios c
-- set slug = e.slug_nuevo
-- from elegidos e
-- where c.id = e.id and e.orden = 1
-- returning c.nombre, c.slug;
-- commit;
