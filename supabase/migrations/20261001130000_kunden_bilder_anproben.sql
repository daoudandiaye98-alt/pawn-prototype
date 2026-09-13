-- Teil O / 4 — Bilder der Kundin (Avatar, Porträt, Räume, Wände) und Anproben.
-- Privater Eimer kunden-bilder, Pfad <user_id>/…, nur die Person selbst liest ihre Bilder
-- (signierte Adressen, kurz gültig). Gäste haben keinen Avatar — das ist der Grund fürs Konto.
-- Jede KI-Anprobe ist als solche gekennzeichnet (EU AI Act Art. 50) und nur ungefähr.

alter table public.profiles add column if not exists consent_avatar boolean not null default false;
alter table public.profiles add column if not exists consent_avatar_at timestamptz;

create table if not exists public.kunden_bilder (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  art             text not null check (art in ('ganzkoerper','portrait','raum','wand')),
  quelle_path     text not null,          -- Original im Eimer kunden-bilder
  basis_path      text,                   -- bereinigte Fassung (freigestellt / entzerrt), null bis erzeugt
  name            text,                   -- „Wohnzimmer", „Flur" — nur bei raum/wand
  masse           jsonb not null default '{}'::jsonb,  -- raum/wand: {referenz:'tuer'|'wandhoehe'|'breite', wert_cm} für ehrliche Größe; ganzkoerper: {koerpergroesse_cm}
  befund          jsonb,                  -- portrait: foto_befund aus pawn-chat stilfoto; raum: {licht,boden,wandton}
  status          text not null default 'bereit' check (status in ('hochgeladen','wird_bereinigt','bereit','fehler')),
  fehler          text,
  aktiv           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists kunden_bilder_user_art on public.kunden_bilder (user_id, art) where aktiv;

-- Genau ein aktiver Ganzkörper-Avatar je Person.
create unique index if not exists kunden_bilder_ein_avatar on public.kunden_bilder (user_id) where art = 'ganzkoerper' and aktiv;

create table if not exists public.anproben (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  bild_id         uuid references public.kunden_bilder(id) on delete set null,
  art             text not null check (art in ('anprobe','raum','wand')),  -- Mode am Körper | Interior im Raum | Kunst an der Wand
  platz           jsonb not null default '{}'::jsonb,   -- raum/wand: {x, y, breite} relativ 0–1 im Bild
  status          text not null default 'angefragt' check (status in ('angefragt','laeuft','fertig','fehler')),
  result_path     text,                                  -- im Eimer kunden-bilder, <user>/anproben/<id>.jpg
  provider        text,
  request_handle  jsonb,
  fehler          text,
  bewertung       text check (bewertung in ('passt','nicht') or bewertung is null),
  dauer_ms        integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists anproben_user_zeit on public.anproben (user_id, created_at desc);
create index if not exists anproben_product on public.anproben (product_id);

alter table public.kunden_bilder enable row level security;
alter table public.anproben      enable row level security;
drop policy if exists "kunden_bilder eigen" on public.kunden_bilder;
create policy "kunden_bilder eigen" on public.kunden_bilder for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "anproben eigen" on public.anproben;
create policy "anproben eigen" on public.anproben for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.kunden_bilder, public.anproben to authenticated;
grant all on public.kunden_bilder, public.anproben to service_role;

-- Der Eimer: privat.
insert into storage.buckets (id, name, public) values ('kunden-bilder', 'kunden-bilder', false) on conflict (id) do nothing;
drop policy if exists "kunden_bilder_eigen_lesen" on storage.objects;
create policy "kunden_bilder_eigen_lesen" on storage.objects for select to authenticated
  using (bucket_id = 'kunden-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kunden_bilder_eigen_schreiben" on storage.objects;
create policy "kunden_bilder_eigen_schreiben" on storage.objects for insert to authenticated
  with check (bucket_id = 'kunden-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kunden_bilder_eigen_loeschen" on storage.objects;
create policy "kunden_bilder_eigen_loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'kunden-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kunden_bilder_service" on storage.objects;
create policy "kunden_bilder_service" on storage.objects for all to service_role
  using (bucket_id = 'kunden-bilder') with check (bucket_id = 'kunden-bilder');

-- Kontingent: 10 Anproben je Tag und Person (für die Function; nicht kaufbar, kein Credit-System für Kundinnen).
create or replace function public.anprobe_kontingent()
returns table (heute integer, frei integer) language sql security definer set search_path = public stable as $fn$
  select count(*)::int as heute, greatest(0, 10 - count(*))::int as frei
  from public.anproben where user_id = auth.uid() and created_at > now() - interval '24 hours' and status <> 'fehler';
$fn$;
revoke all on function public.anprobe_kontingent() from public, anon;
grant execute on function public.anprobe_kontingent() to authenticated, service_role;

-- Ein Konto löschen nimmt alles mit (cascade); zusätzlich: Avatar-Einwilligung zurückziehen = Bilder deaktivieren.
create or replace function public.avatar_einwilligung(_ja boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set consent_avatar = _ja, consent_avatar_at = case when _ja then now() else consent_avatar_at end where id = auth.uid();
  if not _ja then update public.kunden_bilder set aktiv = false, updated_at = now() where user_id = auth.uid(); end if;
end; $fn$;
revoke all on function public.avatar_einwilligung(boolean) from public, anon;
grant execute on function public.avatar_einwilligung(boolean) to authenticated;

