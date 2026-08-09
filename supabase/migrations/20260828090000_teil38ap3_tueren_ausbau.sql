-- Teil 38 AP3: Türen — volles Regal, Matching, Sofort-Mehrwert, Erfolgskette.
-- Digitale Tür-Arten neben den ortsgebundenen Funden (physisch bleibt der bestehende Weg über
-- tueren_finden), ein Matching-Score fürs Sortieren, ein Idempotenz-Schutz gegen Doppel-Läufe
-- und die fehlenden Endzustände der Erfolgskette (gefunden -> interessiert -> kontaktiert ->
-- angenommen/abgelehnt).

alter table public.designer_opportunities
  add column if not exists art text not null default 'physisch',
  add column if not exists match_score integer;

alter table public.designer_opportunities
  drop constraint if exists designer_opportunities_art_check;
alter table public.designer_opportunities
  add constraint designer_opportunities_art_check
  check (art in ('physisch', 'presse', 'edition', 'kollektions_slot'));

alter table public.designer_opportunities
  drop constraint if exists designer_opportunities_status_check;
alter table public.designer_opportunities
  add constraint designer_opportunities_status_check
  check (status in (
    'gefunden', 'interessiert', 'kontaktiert', 'geantwortet', 'angenommen', 'abgelehnt', 'verworfen'
  ));

comment on column public.designer_opportunities.art is
  'physisch (ortsgebunden, von tueren_finden gefunden) | presse (aus der Presse-Jagd) | edition (häuserübergreifende Kampagne) | kollektions_slot (Ausgabe/Kollektion mit freiem Platz)';
comment on column public.designer_opportunities.match_score is
  '0-100, wie gut die Tür zur Marken-DNA/Welt des Hauses passt — höher zuerst anzeigen.';

-- Bereinigt die versehentlichen Doppel-Einträge aus dem Doppel-Feuer-Testlauf vom 09.08.2026
-- (gleicher Titel, gleiches Haus) — behält jeweils den ältesten Eintrag. Muss vor der
-- Idempotenz-Sperre unten laufen, sonst schlägt deren Erstellung an den Duplikaten fehl.
delete from public.designer_opportunities a
  using public.designer_opportunities b
  where a.designer_id = b.designer_id
    and lower(a.title) = lower(b.title)
    and a.created_at > b.created_at;

-- Idempotenz: dieselbe Tür (Titel) kann für dasselbe Haus nicht zweimal angelegt werden, auch
-- wenn tueren_finden versehentlich doppelt feuert.
create unique index if not exists designer_opportunities_designer_title_uidx
  on public.designer_opportunities (designer_id, lower(title));
