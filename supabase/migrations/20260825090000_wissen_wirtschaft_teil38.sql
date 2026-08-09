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
