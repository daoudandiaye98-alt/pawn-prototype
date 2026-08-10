-- Part 38 AP1 — Wirtschafts-Kanal: brand_knowledge bekommt eine Kategorie, damit Markenaufbau-
-- Wissen (bestehend, Modus wissen_markenaufbau) und neues Wirtschaftswissen (Modus
-- wissen_wirtschaft: Kalkulation, Produktion, Vertriebswege, USt/Versand) nebeneinander im
-- selben Speicher leben, statt eine Parallel-Tabelle zu bauen (Wiederverwendungs-Prinzip).
-- Bestehende Zeilen sind alle Markenaufbau-Wissen (der einzige Schreiber bisher), daher der
-- Default.
alter table public.brand_knowledge
  add column if not exists kategorie text not null default 'markenaufbau';

create index if not exists brand_knowledge_kategorie_idx on public.brand_knowledge (kategorie, active, approved, created_at desc);

-- Zweiter, unabhängig gefundener Fehler bei der Code-Durchsicht: jarvis_reports_kind_check
-- (zuletzt erweitert in Migration 20260723094500) fehlen vier "kind"-Werte, die der Code
-- bereits schreibt — "zeitgeist" (Modus zeitgeist), "markenaufbau" (Modus wissen_markenaufbau),
-- "jagd" (Akquise-Jagd-Auswertung) und jetzt neu "wirtschaft" (Modus wissen_wirtschaft). Jeder
-- betroffene INSERT scheitert bisher lautlos an der Constraint (der Code prüft den Insert-Fehler
-- nicht), ohne den jarvis_runs-Lauf selbst als failed zu markieren — das erklärt fehlende
-- jarvis_reports-Dossiers, aber nicht den separaten Cron-Auth-Fehler, der in derselben
-- Auslieferung im Code behoben wurde.
alter table public.jarvis_reports drop constraint if exists jarvis_reports_kind_check;
alter table public.jarvis_reports add constraint jarvis_reports_kind_check
  check (kind in ('morgen', 'woche', 'recherche', 'antwort', 'diagnose', 'dossier', 'regie', 'wissen', 'zeitgeist', 'markenaufbau', 'wirtschaft', 'jagd'));

-- Part 38 AP2 — designers.weekly_impulse existierte bereits (per AUFTRAG als wiederzuverwendendes
-- Feld genannt), war aber als boolean angelegt und nirgends im Code gelesen oder geschrieben —
-- ein totes Feld. Ein Wissens-Impuls ist ein kurzer Satz, kein Schalter: das Feld wird auf text
-- umgestellt, um den tatsächlich beabsichtigten Zweck (ein kurzer, DNA-passender Wissens-Impuls
-- pro Woche) zu tragen. Unbedenklich, weil das Feld verifiziert nirgends gelesen/geschrieben wird.
alter table public.designers alter column weekly_impulse drop default;
alter table public.designers alter column weekly_impulse drop not null;
alter table public.designers alter column weekly_impulse type text using null;
alter table public.designers alter column weekly_impulse set default null;

alter table public.designers add column if not exists weekly_impulse_at timestamptz;

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

-- Teil 38 AP4: Medien — Fehler beheben + PAWN als Regisseur.
-- Ermöglicht poll-broll einen einmaligen automatischen Neuversuch bei vermutlich
-- vorübergehenden Fehlern, ein korrektes video_dna (Signatur + echte Länge statt immer
-- "5s, keine Signatur"), und PAWNs eigene strukturelle Einschätzung direkt nach der Erzeugung.

alter table public.generation_requests
  add column if not exists retry_count integer not null default 0,
  add column if not exists signature_id uuid references public.house_signatures(id) on delete set null,
  add column if not exists duration_s integer;

alter table public.video_assets
  add column if not exists regisseur_verdict jsonb;

comment on column public.generation_requests.retry_count is
  'Teil 38 AP4: wie oft dieser Auftrag nach einem vermutlich vorübergehenden Fehler automatisch neu gestartet wurde (höchstens 1).';
comment on column public.generation_requests.signature_id is
  'Teil 38 AP4: welche Haus-Signatur (falls gewählt) diesem Auftrag zugrunde lag — damit poll-broll das echte video_dna schreiben kann statt immer null.';
comment on column public.generation_requests.duration_s is
  'Teil 38 AP4: die tatsächlich angeforderte Länge in Sekunden (5 oder 10) — vorher schrieb poll-broll immer 5 ins video_dna, auch bei 10s-Aufnahmen.';
comment on column public.video_assets.regisseur_verdict is
  'Teil 38 AP4: PAWNs eigene strukturelle Einschätzung direkt nach der Erzeugung — {passt: boolean, punkte: string[], iterationsvorschlag: string}.';

-- Teil 38 AP6 — Mini-PAWNs: das bestehende Automatik-Framework (designer_automations,
-- Teil 28c) bekommt vier neue, pro Haus schaltbare Organe statt einer eigenen neuen
-- house_settings.organe-Struktur (Wiederverwendungsprinzip — ein Framework für "welche
-- Automatik läuft für dieses Haus" reicht). 'sichtbarkeitszug' migriert dabei nur das bereits
-- bestehende Verhalten aus runMaisonSichtbarkeitszug in den Schalter-Rahmen (Rückwärtskompatibel:
-- fehlt die Zeile, gilt es weiterhin als an). 'presse'/'verstaerker_haus' sind neue, zusätzliche
-- Organe. 'impuls' bleibt rein informativ gelistet — der wochenimpuls aus Teil 38 AP2 bleibt
-- plattformweit/kostenlos und bekommt hier keinen eigenen Schalter.

alter table public.designer_automations drop constraint if exists designer_automations_automation_key_check;

alter table public.designer_automations add constraint designer_automations_automation_key_check
  check (automation_key in (
    'inszenieren_bei_upload', 'caption_nach_inszenierung', 'aufraeumen_woechentlich', 'sharekit_bei_live',
    'sichtbarkeitszug', 'presse', 'verstaerker_haus', 'impuls'
  ));