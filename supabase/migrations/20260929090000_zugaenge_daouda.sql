-- Zugaenge fuer Daouda: Admin und Designer, ohne Passwort und ohne service_role.
-- Wer sich mit einer der beiden Adressen anmeldet, bekommt seine Rolle sofort.
-- Der Designer-Teil greift erst, wenn es die Tabelle designers gibt (Guard unten).
--
-- HERKUNFT: Diese Migration lag am 11.09.2026 auf dem Projekt cnxtdcifkrdxvajaikxq,
-- hatte aber KEINE Datei im Repo. Nach Gesetz 1 existiert nicht, was keine Datei ist —
-- und der Rueckweg des Erstaufbaus (drop schema public cascade) haette sie ersatzlos
-- geloescht. Der Inhalt hier ist woertlich aus supabase_migrations.schema_migrations
-- zurueckgeholt, bevor irgendetwas geloescht wurde.

create table if not exists public.zugang_bootstrap (
  email     text primary key,
  rolle     app_role not null,
  haus_slug text,
  notiz     text
);

alter table public.zugang_bootstrap enable row level security;

insert into public.zugang_bootstrap (email, rolle, haus_slug, notiz) values
  ('pawnstudio.co@gmail.com', 'admin',    null,         'Admin-Zugang Daouda'),
  ('dodondiaye99@gmail.com',  'designer', 'demo-drape', 'Designer-Zugang Daouda, uebernimmt DRAPE')
on conflict (email) do update
  set rolle = excluded.rolle, haus_slug = excluded.haus_slug, notiz = excluded.notiz;

create unique index if not exists user_roles_user_role_uniq on public.user_roles (user_id, role);

create or replace function public.zugang_zuweisen(_user_id uuid, _email text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare b public.zugang_bootstrap%rowtype;
begin
  select * into b from public.zugang_bootstrap where email = lower(_email);
  if not found then return; end if;

  insert into public.user_roles (user_id, role)
  values (_user_id, b.rolle)
  on conflict (user_id, role) do nothing;

  insert into public.profiles (id, display_name)
  values (_user_id, split_part(b.email, '@', 1))
  on conflict (id) do nothing;

  if b.rolle = 'designer' and b.haus_slug is not null
     and to_regclass('public.designers') is not null then
    execute 'update public.designers set user_id = $1 where slug = $2 and (user_id is null or user_id = $1)'
      using _user_id, b.haus_slug;
  end if;
end;
$fn$;

create or replace function public.zugang_bei_anmeldung()
returns trigger
language plpgsql
security definer
set search_path = public
as $tg$
begin
  perform public.zugang_zuweisen(new.id, new.email);
  return new;
end;
$tg$;

drop trigger if exists zugang_bootstrap_trigger on auth.users;
create trigger zugang_bootstrap_trigger
  after insert on auth.users
  for each row execute function public.zugang_bei_anmeldung();

do $do$
declare u record;
begin
  for u in select id, email from auth.users
            where lower(email) in (select email from public.zugang_bootstrap)
  loop
    perform public.zugang_zuweisen(u.id, u.email);
  end loop;
end $do$;
