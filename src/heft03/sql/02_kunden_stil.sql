-- kunden_stil: das Ergebnis der Stilberatung (Bilderquiz) je Konto.
-- Heute lebt das Quiz nur im Gerät (localStorage pawn.heft.v1, nur mit Zustimmung).
-- Diese Tabelle macht es kontoweit: Welt → Richtung → Form (+ Für-wen, + Foto-Befund als Beobachtung).
-- Kein Foto wird gespeichert — nur die Terme, die pawn-chat (mode stilfoto) daraus liest.

create table if not exists public.kunden_stil (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  welt         text check (welt in ('mode','interior','kunst')),
  richtung     text,                 -- Mode: Klar|Weich|Roh|Laut · Interior: Still|Warm|Roh|Skulptural · Kunst: Figurativ|Abstrakt|Geste|Plastisch
  form         text,                 -- Mode: Gerade|Weit|Tailliert|Lagen · Interior: Holz|Ton|Stahl|Textil · Kunst: Klein|Wandfüllend|Serie|Objekt
  fuer_wen     text check (fuer_wen is null or fuer_wen in ('Damen','Herren','Beides')),
  foto_befund  jsonb,                -- {hautton, unterton, augenfarbe, haarfarbe, farben_passen[], farben_meiden[]} bzw. Raum-/Wandbefund
  quelle       text not null default 'heft-quiz',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.kunden_stil enable row level security;

drop policy if exists "kunde liest eigenen stil" on public.kunden_stil;
create policy "kunde liest eigenen stil" on public.kunden_stil
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "kunde schreibt eigenen stil" on public.kunden_stil;
create policy "kunde schreibt eigenen stil" on public.kunden_stil
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "kunde aendert eigenen stil" on public.kunden_stil;
create policy "kunde aendert eigenen stil" on public.kunden_stil
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "kunde loescht eigenen stil" on public.kunden_stil;
create policy "kunde loescht eigenen stil" on public.kunden_stil
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.kunden_stil to authenticated;

create or replace function public.kunden_stil_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists kunden_stil_touch on public.kunden_stil;
create trigger kunden_stil_touch before update on public.kunden_stil for each row execute function public.kunden_stil_touch();

comment on table public.kunden_stil is 'Stilberatung des Hefts: Welt/Richtung/Form je Konto. Löschen = Konto löschen (cascade) oder "Alles löschen" im Heft.';
