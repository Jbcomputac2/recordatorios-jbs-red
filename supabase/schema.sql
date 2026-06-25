-- ═════════════════════════════════════════════════════════════
-- Recordatorios del Profe — schema "recordatorios"
-- Pega en Supabase Studio → SQL Editor → Run. Idempotente.
-- ═════════════════════════════════════════════════════════════

create schema if not exists recordatorios;

-- ─── Categorías (sembradas al crear el usuario) ──────────────
create table if not exists recordatorios.categorias (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,
  emoji         text not null default '📌',
  color         text not null default '#007aff',
  sonido        text default 'default',  -- nombre de sonido en la app ntfy
  orden         int  not null default 0,
  date_created  timestamptz not null default now()
);

-- ─── Items (los recordatorios) ───────────────────────────────
create table if not exists recordatorios.items (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  categoria_id  bigint references recordatorios.categorias(id) on delete set null,
  titulo        text not null,
  descripcion   text,
  hora          time not null default '09:00:00',
  rrule         text,  -- null = una sola vez. Ej: "FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  fecha_inicio  date not null default current_date,
  fecha_fin     date,
  next_at       timestamptz,  -- precomputado por el cliente; pg_cron filtra por aquí
  activo        boolean not null default true,
  prioridad     int    not null default 4 check (prioridad between 1 and 5),
  sonido        text,         -- override de la categoría
  click_url     text,         -- abre algo al tap (Zoom, link, etc.)
  acciones      jsonb not null default '[{"label":"✓ Hecho","kind":"done"},{"label":"+10 min","kind":"snooze","minutes":10},{"label":"+1 hora","kind":"snooze","minutes":60}]'::jsonb,
  timezone      text not null default 'America/Mexico_City',
  date_created  timestamptz not null default now(),
  date_updated  timestamptz not null default now(),
  last_sent_at  timestamptz,
  last_done_at  timestamptz
);

-- ─── Log de envíos ───────────────────────────────────────────
create table if not exists recordatorios.eventos (
  id            bigint generated always as identity primary key,
  item_id       bigint references recordatorios.items(id) on delete cascade,
  user_id       uuid,
  scheduled_at  timestamptz not null,
  sent_at       timestamptz,
  status        text not null default 'pending', -- pending|sent|done|snoozed|failed
  detalle       text
);

-- ─── Settings por usuario ────────────────────────────────────
create table if not exists recordatorios.settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  ntfy_topic     text not null,
  ntfy_url       text not null default 'https://ntfy.jbs.red',
  webhook_secret text not null default replace(gen_random_uuid()::text, '-', ''),
  quiet_start    time,   -- ej. 23:00
  quiet_end      time,   -- ej. 07:00
  quiet_carry    boolean not null default true, -- guardar y mandar al terminar
  timezone       text   not null default 'America/Mexico_City',
  date_created   timestamptz not null default now()
);

-- ─── Triggers ────────────────────────────────────────────────
create or replace function recordatorios.set_user_id() returns trigger
language plpgsql security definer as $$
begin if new.user_id is null then new.user_id = auth.uid(); end if; return new; end; $$;

drop trigger if exists trg_items_uid on recordatorios.items;
create trigger trg_items_uid before insert on recordatorios.items
  for each row execute function recordatorios.set_user_id();

drop trigger if exists trg_cats_uid on recordatorios.categorias;
create trigger trg_cats_uid before insert on recordatorios.categorias
  for each row execute function recordatorios.set_user_id();

create or replace function recordatorios.set_updated() returns trigger
language plpgsql as $$
begin new.date_updated = now(); return new; end; $$;

drop trigger if exists trg_items_updated on recordatorios.items;
create trigger trg_items_updated before update on recordatorios.items
  for each row execute function recordatorios.set_updated();

-- ─── Bootstrap del usuario (categorías + settings) ───────────
create or replace function recordatorios.bootstrap_user() returns trigger
language plpgsql security definer as $$
declare topic text;
begin
  topic := 'rec-' || substring(replace(new.id::text, '-', '') from 1 for 12);
  insert into recordatorios.settings (user_id, ntfy_topic)
    values (new.id, topic)
    on conflict (user_id) do nothing;
  insert into recordatorios.categorias (user_id, nombre, emoji, color, sonido, orden) values
    (new.id, 'Salud',     '💊', '#ff3b30', 'siren',     1),
    (new.id, 'Trabajo',   '📅', '#007aff', 'classical', 2),
    (new.id, 'Ejercicio', '🏃', '#34c759', 'cosmic',    3),
    (new.id, 'Dinero',    '💰', '#ff9500', 'pristine',  4),
    (new.id, 'Familia',   '📞', '#af52de', 'tugboat',   5),
    (new.id, 'General',   '📌', '#8e8e93', 'default',   6);
  return new;
end; $$;

drop trigger if exists trg_user_bootstrap on auth.users;
create trigger trg_user_bootstrap after insert on auth.users
  for each row execute function recordatorios.bootstrap_user();

-- ─── Índices ─────────────────────────────────────────────────
create index if not exists idx_items_user      on recordatorios.items(user_id);
create index if not exists idx_items_next      on recordatorios.items(next_at) where activo = true;
create index if not exists idx_items_user_next on recordatorios.items(user_id, next_at);
create index if not exists idx_cats_user       on recordatorios.categorias(user_id, orden);
create index if not exists idx_eventos_item    on recordatorios.eventos(item_id, scheduled_at desc);

-- ─── RLS ─────────────────────────────────────────────────────
alter table recordatorios.items      enable row level security;
alter table recordatorios.categorias enable row level security;
alter table recordatorios.eventos    enable row level security;
alter table recordatorios.settings   enable row level security;

drop policy if exists items_owner on recordatorios.items;
create policy items_owner on recordatorios.items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cats_owner on recordatorios.categorias;
create policy cats_owner on recordatorios.categorias for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists evs_owner on recordatorios.eventos;
create policy evs_owner on recordatorios.eventos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists settings_owner on recordatorios.settings;
create policy settings_owner on recordatorios.settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema recordatorios to anon, authenticated, service_role;
grant all on all tables    in schema recordatorios to authenticated, service_role;
grant all on all sequences in schema recordatorios to authenticated, service_role;
alter default privileges in schema recordatorios grant all on tables    to authenticated, service_role;
alter default privileges in schema recordatorios grant all on sequences to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════
-- DESPUÉS de correr este archivo:
--
-- 1. En EasyPanel → supabase → Environment, AGREGA 'recordatorios':
--    PGRST_DB_SCHEMAS=public,storage,graphql_public,notas,recordatorios
--    → Deploy
--
-- 2. Extensiones + cron (en SQL Editor):
--
--    create extension if not exists pg_cron;
--    create extension if not exists pg_net;
--    alter database postgres set "app.tick_secret" = 'PON-UN-SECRETO-LARGO';
--
--    select cron.schedule('tick-recordatorios', '* * * * *', $tick$
--      select net.http_post(
--        url := 'https://recordatorios.jbs.red/api/tick',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || current_setting('app.tick_secret'),
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
--    $tick$);
--
--    -- Si te equivocas y quieres reagendarlo:
--    -- select cron.unschedule('tick-recordatorios');
-- ═════════════════════════════════════════════════════════════
