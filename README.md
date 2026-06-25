# Recordatorios del Profe

> Recordatorios al celular con sonido custom, prioridad alta y botones "Hecho / +10 min" desde el lock screen.

**Web app responsive** — abre desde celular o computadora, las notificaciones siempre llegan a tu celu vía ntfy.

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase autoalojado (Postgres + Auth) — schema `recordatorios`
- ntfy autoalojado para entrega push
- **pg_cron + pg_net** disparan `/api/tick` cada minuto
- `rrule` para recurrencia (diario / Lun-Vie / cada lunes / día 1 del mes / etc.)

## Setup Supabase (una sola vez)

1. **Schema:** pega `supabase/schema.sql` en Supabase Studio → SQL Editor → Run.
2. **Expón el schema** a PostgREST en EasyPanel → servicio `supabase` → Environment:
   ```
   PGRST_DB_SCHEMAS=public,storage,graphql_public,notas,recordatorios
   ```
   Haz Deploy.
3. **Activa extensiones y agenda el cron** — en SQL Editor:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   alter database postgres set "app.tick_secret" = 'EL-MISMO-TICK_SECRET-DE-TU-.env';

   select cron.schedule('tick-recordatorios', '* * * * *', $tick$
     select net.http_post(
       url := 'https://recordatorios.jbs.red/api/tick',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.tick_secret'),
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
   $tick$);
   ```

## Desplegar en EasyPanel

1. New service → App → GitHub → repo `Jbcomputac2/recordatorios-jbs-red`.
2. Build: Dockerfile (lo detecta solo).
3. **Build args** (publicas):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://supabase.jbs.red
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>
   NEXT_PUBLIC_NTFY_URL=https://ntfy.jbs.red
   ```
4. **Runtime env** (server-only):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   TICK_SECRET=<el mismo de tu pg_cron>
   ```
5. Puerto 3000. Dominio `recordatorios.jbs.red`.

## Cómo se usa

1. Abre `recordatorios.jbs.red` en tu celular → Safari/Chrome → "Añadir a pantalla de inicio". Queda como app.
2. Abre la app de ntfy → suscríbete al topic que aparece en **Ajustes** (algo como `rec-abc123`).
3. Activa "Permitir notificaciones" para ntfy y enciende prioridad alta.
4. Listo. Crea recordatorios desde donde quieras.

## Cómo funciona el "reloj"

```
[Tu web/celular]
       │ crea recordatorio
       ▼
[Supabase: recordatorios.items]
       │
       │ cada minuto
       ▼
[pg_cron] ── http_post ──► /api/tick (Next.js)
                                │
                                │ selecciona items con next_at <= now()
                                ▼
                          [POST a ntfy]
                                │
                                ▼
                        [Notificación en celu]
                                │ tap "Hecho" / "+10 min"
                                ▼
                          /api/ntfy webhook
                                │
                                ▼
                        [Supabase: last_done_at]
```
