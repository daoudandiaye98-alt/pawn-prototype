-- Teil O / 1 — Der Begleiter: Sätze, Regeln, Gedächtnis, Ereignisse.
-- Der Bauer sagt nur, was in begleiter_saetze steht (pflegbar im Cockpit), und nur,
-- wenn eine Regel aus begleiter_regeln es erlaubt. Was er gesagt hat, merkt er sich
-- je Konto in begleiter_gedaechtnis (Gäste: nur auf dem Gerät). Ereignisse landen
-- in begleiter_ereignisse — nur eingeloggt und nur mit Analyse-Zustimmung.

create table if not exists public.begleiter_saetze (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  flaeche      text not null check (flaeche in ('heft','studio','beide')),
  kontext      text,                         -- hero | stage | lesen | dna | haus | werk | konto | kasse | studio_hub …
  welt         text check (welt in ('mode','interior','kunst') or welt is null),
  register     text not null default 'buehne' check (register in ('buehne','betrieb')),
  varianten    jsonb not null default '{"de":[],"en":[]}'::jsonb,   -- {de:[…], en:[…]} — eine wird zufällig gewählt
  platzhalter  text[] not null default '{}',                          -- z. B. {werk, haus, material, n}
  aktiv        boolean not null default true,
  notiz        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.begleiter_regeln (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  flaeche        text not null check (flaeche in ('heft','studio')),
  ereignis       text not null,               -- betreten | stillstand | blaettern | verweilen | merken | haus_betreten | welt_gewaehlt | quiz_fertig | suche_leer | rueckkehr | kasse | kauf | hilfe_gesucht | anprobe_fertig | zug_erledigt …
  bedingung      jsonb not null default '{}'::jsonb,  -- {besuch:'erster'|'wieder', linie:true|false, merkliste_min:2, welt:'mode', konto:true|false, avatar:false, min_ms:6000 …}
  satz_key       text references public.begleiter_saetze(key) on delete set null,
  aktion         jsonb not null default '{}'::jsonb,  -- {art:'sagen'|'anbieten'|'fuehren'|'oeffnen', ziel:'/deine-dna/welt', chips:[{text,route}], funktion:'anprobe'}
  prioritaet     integer not null default 50,          -- höher gewinnt; genau eine Regel je Takt
  abklingzeit_s  integer not null default 60,          -- Mindestabstand zur letzten Blase überhaupt
  einmal         text check (einmal in ('sitzung','immer') or einmal is null),
  aktiv          boolean not null default true,
  notiz          text,
  created_at     timestamptz not null default now()
);

create table if not exists public.begleiter_gedaechtnis (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  gesagt         jsonb not null default '{}'::jsonb,   -- {satz_key: iso-zeit}
  abgelehnt      text[] not null default '{}',          -- Angebote, die mit × weggeklickt wurden (nie wieder)
  angenommen     text[] not null default '{}',
  besuche        integer not null default 0,
  letzter_besuch timestamptz,
  rang           text not null default 'bauer' check (rang in ('bauer','springer','laeufer','turm','dame')),
  notizen        jsonb not null default '{}'::jsonb,   -- {zuletzt_gesehen:[slugs], zuletzt_haus:slug, quiz_schritt:…}
  updated_at     timestamptz not null default now()
);

create table if not exists public.begleiter_ereignisse (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  session_id  text,
  flaeche     text not null check (flaeche in ('heft','studio')),
  ereignis    text not null,
  daten       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint begleiter_ereignisse_daten_klein check (pg_column_size(daten) < 2048)
);
create index if not exists begleiter_ereignisse_user_zeit on public.begleiter_ereignisse (user_id, created_at desc);
create index if not exists begleiter_ereignisse_art_zeit  on public.begleiter_ereignisse (ereignis, created_at desc);

alter table public.begleiter_saetze      enable row level security;
alter table public.begleiter_regeln      enable row level security;
alter table public.begleiter_gedaechtnis enable row level security;
alter table public.begleiter_ereignisse  enable row level security;

-- Kataloge liest jeder (auch Gäste); schreiben darf nur der Admin.
drop policy if exists "begleiter_saetze lesen" on public.begleiter_saetze;
create policy "begleiter_saetze lesen" on public.begleiter_saetze for select to anon, authenticated using (aktiv);
drop policy if exists "begleiter_saetze admin" on public.begleiter_saetze;
create policy "begleiter_saetze admin" on public.begleiter_saetze for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "begleiter_regeln lesen" on public.begleiter_regeln;
create policy "begleiter_regeln lesen" on public.begleiter_regeln for select to anon, authenticated using (aktiv);
drop policy if exists "begleiter_regeln admin" on public.begleiter_regeln;
create policy "begleiter_regeln admin" on public.begleiter_regeln for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Gedächtnis: nur die eigene Zeile.
drop policy if exists "begleiter_gedaechtnis eigen" on public.begleiter_gedaechtnis;
create policy "begleiter_gedaechtnis eigen" on public.begleiter_gedaechtnis for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ereignisse: eigene schreiben, eigene lesen; Admin liest alles (Jarvis läuft als service_role).
drop policy if exists "begleiter_ereignisse eigen" on public.begleiter_ereignisse;
create policy "begleiter_ereignisse eigen" on public.begleiter_ereignisse for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid());

grant select on public.begleiter_saetze, public.begleiter_regeln to anon, authenticated;
grant select, insert, update on public.begleiter_gedaechtnis to authenticated;
grant select, insert on public.begleiter_ereignisse to authenticated;
grant all on public.begleiter_saetze, public.begleiter_regeln, public.begleiter_gedaechtnis, public.begleiter_ereignisse to service_role;
grant usage, select on sequence public.begleiter_ereignisse_id_seq to authenticated;

-- Eine Funktion fürs Merken: setzt gesagt/abgelehnt/angenommen und zählt Besuche.
create or replace function public.begleiter_merken(_satz_key text, _antwort text default null, _notizen jsonb default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return; end if;
  insert into public.begleiter_gedaechtnis (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.begleiter_gedaechtnis set
    gesagt     = case when _satz_key is not null then gesagt || jsonb_build_object(_satz_key, now()) else gesagt end,
    abgelehnt  = case when _antwort = 'abgelehnt'  and _satz_key is not null and not (_satz_key = any(abgelehnt))  then array_append(abgelehnt,  _satz_key) else abgelehnt end,
    angenommen = case when _antwort = 'angenommen' and _satz_key is not null and not (_satz_key = any(angenommen)) then array_append(angenommen, _satz_key) else angenommen end,
    notizen    = case when _notizen is not null then notizen || _notizen else notizen end,
    updated_at = now()
  where user_id = auth.uid();
end; $fn$;
revoke all on function public.begleiter_merken(text, text, jsonb) from public, anon;
grant execute on function public.begleiter_merken(text, text, jsonb) to authenticated;

-- Besuch zählen (einmal je Sitzung vom Heft gerufen) und den Rang neu rechnen.
create or replace function public.begleiter_besuch()
returns table (besuche integer, rang text, letzter_besuch timestamptz) language plpgsql security definer set search_path = public as $fn$
declare r public.begleiter_gedaechtnis%rowtype; neuer_rang text;
begin
  if auth.uid() is null then return; end if;
  insert into public.begleiter_gedaechtnis (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into r from public.begleiter_gedaechtnis where user_id = auth.uid();
  -- Rang = Wissen über die Person, nie kaufbar:
  -- bauer: nichts · springer: Welt · laeufer: Linie (Richtung+Form) · turm: Foto-Befund oder Maße · dame: Avatar + bestätigter Archetyp
  neuer_rang := 'bauer';
  if exists (select 1 from public.kunden_stil k where k.user_id = auth.uid() and k.welt is not null) then neuer_rang := 'springer'; end if;
  if exists (select 1 from public.kunden_stil k where k.user_id = auth.uid() and k.richtung is not null and k.form is not null) then neuer_rang := 'laeufer'; end if;
  if exists (select 1 from public.kunden_stil k where k.user_id = auth.uid() and k.foto_befund is not null)
     or exists (select 1 from public.customer_measurements m where m.user_id = auth.uid()) then neuer_rang := 'turm'; end if;
  if to_regclass('public.kunden_bilder') is not null and to_regclass('public.kunden_archetyp') is not null then
    if exists (select 1 from public.kunden_bilder b where b.user_id = auth.uid() and b.art = 'ganzkoerper' and b.aktiv)
       and exists (select 1 from public.kunden_archetyp a where a.user_id = auth.uid() and a.bestaetigt) then neuer_rang := 'dame'; end if;
  end if;
  update public.begleiter_gedaechtnis g set besuche = g.besuche + 1, rang = neuer_rang, updated_at = now() where g.user_id = auth.uid();
  -- r.letzter_besuch ist der VORIGE Besuch (für „Willkommen zurück"); erst zurückgeben, dann nachziehen.
  return query select r.besuche + 1, neuer_rang, r.letzter_besuch;
  update public.begleiter_gedaechtnis g set letzter_besuch = now() where g.user_id = auth.uid();
end; $fn$;
revoke all on function public.begleiter_besuch() from public, anon;
grant execute on function public.begleiter_besuch() to authenticated;

