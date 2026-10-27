# Alertas del SMN y viento en el widget del clima

## Qué hace

El widget del clima del inicio muestra:

- **Viento** de MET Norway: velocidad en km/h y dirección desde donde sopla (por ejemplo "20 km/h del NE"). MET Norway no trae ráfagas para Argentina, así que no se muestran.
- **Aviso de viento fuerte**: cuando la velocidad media prevista en las próximas 12 h llega a 50 km/h. Es el comienzo de la fuerza 7 de Beaufort ("viento fuerte", 50 a 61 km/h). Se cambia con `UMBRAL_VIENTO_KMH` en `src/lib/clima.ts`.
- **Alertas oficiales del SMN** (amarillas, naranjas y rojas) vigentes, o que empiezan en las próximas 12 h, para Nogoyá. La más grave sale primero, con ícono, nivel escrito, horario y "Fuente: SMN". Si el texto de la alerta menciona ráfagas, se muestran.
  - Si no hay alertas: "Sin alertas vigentes".
  - Si no se pudo consultar: "No pudimos consultar las alertas". Nunca un falso "sin alertas".

## Cómo funciona

1. El SMN publica un feed (`https://ssl.smn.gob.ar/CAP/AR.php`) con un XML CAP por zona: hoy son unos 150. La zona viene como un polígono, no como nombre de departamento.
2. El SMN **corta con error 429 si se le piden muchos XML seguidos**. Por eso nadie los pide en cada visita.
3. La Edge Function **`alertas-smn`** corre cada 10 minutos con `pg_cron`:
   - Baja solo los XML nuevos, de a uno, con 1 segundo de pausa y como mucho 60 por vuelta.
   - Saltea los de Cordillera y Patagonia.
   - Guarda en `alertas_smn_xml` cuáles tocan a Nogoyá, y en `alertas_smn_estado` cómo terminó la vuelta.
   - Si el SMN responde 429, corta y sigue en la próxima vuelta.
4. **`/api/alertas`** (Vercel) lee esas tablas con la anon key y nunca consulta al SMN. Responde error si el cron no corrió en los últimos 30 minutos, o si la última vuelta quedó incompleta sin ninguna alerta para mostrar.

Cuando el SMN publica una emisión nueva, la primera carga son unos 80 XML: dos vueltas, unos 20 minutos. Después, casi nada hasta la próxima emisión.

## Qué hay que hacer en Supabase (una vez)

### 1. Extensiones
Supabase → **Database → Extensions** → activar **`pg_cron`** y **`pg_net`**, si no están.

### 2. Secreto del cron
Si ya existe por los recordatorios de WhatsApp, se reusa el mismo.

- Supabase → **Edge Functions → Secrets** → que exista **`CRON_SECRET`**.
- El mismo valor guardado en Vault. Supabase → **SQL Editor**:
  ```sql
  SELECT vault.create_secret('<el mismo valor de CRON_SECRET>', 'cron_secret');
  ```
  (Si ya existe, no hace falta.)

### 3. Desplegar la función
Desde la carpeta del proyecto, con la [CLI de Supabase](https://supabase.com/docs/guides/cli) iniciada (`supabase login` y `supabase link --project-ref graipurciaipsoonmtqk`):

```bash
supabase functions deploy alertas-smn --no-verify-jwt
```

`--no-verify-jwt` hace falta porque el cron no manda token de usuario. La función la protege el encabezado `x-cron-secret`, y sin `CRON_SECRET` no corre.

### 4. Tablas, permisos y cron
Supabase → **SQL Editor** → correr [`supabase/propuestas/20261022_alertas_smn.sql`](../supabase/propuestas/20261022_alertas_smn.sql) por partes:

- **Parte 1:** tablas `alertas_smn_xml` y `alertas_smn_estado`.
- **Parte 2:** lectura pública. Solo escribe la función.
- **Parte 3:** el cron cada 10 minutos. **Antes, reemplazar `<REF>` por `graipurciaipsoonmtqk`** en la URL.

### 5. Comprobar (a los 20 minutos)
```sql
SELECT * FROM public.alertas_smn_estado;
```
Tiene que decir `completo = true` y un `actualizado_at` reciente.

```sql
SELECT url, alerta FROM public.alertas_smn_xml WHERE en_nogoya;
```
Muestra las alertas que tocan a Nogoyá, si hay.

```sql
SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;
```
Muestra las respuestas de la función. Un 401 quiere decir que `CRON_SECRET` y `cron_secret` de Vault no coinciden, o que se desplegó sin `--no-verify-jwt`.

También están los logs en Supabase → **Edge Functions → alertas-smn → Logs** (evento `alertas_smn`).

## Vercel
No hay que configurar nada nuevo. `/api/alertas` usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, que ya existen.

## Cómo probarlo a mano
1. Abrir el inicio (preview de Vercel o `pnpm dev`) y mirar el widget del clima. Si hay alertas para Nogoyá, aparecen con el nivel; si no, dice "Sin alertas vigentes".
2. Caso de error: desactivar el cron con
   ```sql
   SELECT cron.unschedule('alertas-smn');
   ```
   A los 30 minutos tiene que aparecer "No pudimos consultar las alertas". Después volver a programarlo con la parte 3 del SQL.
3. Las alertas vigentes también se pueden ver en https://www.smn.gob.ar/alertas, para comparar.

## Para sacarlo
```sql
SELECT cron.unschedule('alertas-smn');
```
