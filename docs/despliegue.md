# Cómo desplegar estas correcciones

El código nuevo depende de la migración `20261015000001_seguridad_y_negocio.sql`. Si se publica el frontend antes de aplicar la migración, fallan los pagos, los horarios y las métricas. Seguí este orden.

## 1. Antes de mergear

1. **Backup de la base.** Supabase → Database → Backups. La migración borra todas las reglas RLS existentes de las tablas de la app (incluidas las creadas a mano) y las reemplaza por las del repo.
2. **Variables de entorno en Vercel.** `.env` ya no está en el repo. En Vercel → Settings → Environment Variables, cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para Production y Preview. Sin esto, la app muestra un error al abrir.
3. **Migración.** Supabase → SQL Editor → pegar y correr `supabase/migrations/20261015000001_seguridad_y_negocio.sql` (o `supabase db push`). Se puede correr más de una vez.
4. **pg_cron.** Si la migración avisa que `pg_cron` no está disponible, activalo en Database → Extensions y volvé a correrla. Marca las suscripciones vencidas todos los días a las 00:15.
5. **Edge Functions.**
   ```bash
   supabase functions deploy admin-crear-comerciante
   supabase functions deploy cron-recordatorios-whatsapp
   supabase secrets set CRON_SECRET="<una-clave-larga-al-azar>" ALLOWED_ORIGINS="https://<tu-dominio>"
   ```
   Opcionales para enviar WhatsApp automático: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` (plantilla aprobada por Meta) y `WHATSAPP_TEMPLATE_LANG`.
6. **Registro público.** Supabase → Authentication → Sign In / Providers: desactivar "Allow new users to sign up". Las cuentas de comerciantes las crea el admin desde la app.

## 2. Mergear

Al mergear, Vercel despliega el frontend.

## 3. Después de desplegar

1. Entrar como admin → Comercios. Si aparece el aviso de comercios sin ubicación, tocar **Ubicar en el mapa** (tarda 1 segundo por comercio). Hasta entonces esos comercios figuran en la lista pero no en el mapa.
2. Revisar el campo `email_comercial` de los comercios existentes: antes guardaba el email de login. Ahora es el email público del comercio.
3. Probar el login de un comerciante y de un admin.

## Recordatorios automáticos por WhatsApp (opcional)

Con `pg_cron` y `pg_net` activos, este SQL llama a la función todos los días a las 9:00 de Argentina:

```sql
select cron.schedule('recordatorios-whatsapp', '0 12 * * *', $$
  select net.http_post(
    url := 'https://<PROYECTO>.supabase.co/functions/v1/cron-recordatorios-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    )
  );
$$);
```

## Pendiente en sus máquinas

El entorno donde se hicieron estos cambios no tenía acceso al registro de npm, así que no se tocaron dependencias (el lockfile tiene que coincidir con `package.json` para que Vercel instale). Para limpiar las que no se usan:

```bash
pnpm remove recharts date-fns zod react-hook-form @hookform/resolvers clsx tailwind-merge
```

Comandos útiles: `pnpm typecheck` (tipos) y `pnpm test` (tests de horarios, WhatsApp y fechas).
