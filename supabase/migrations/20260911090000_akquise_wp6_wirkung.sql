-- PART "Die ersten Fünfzig" · WP6 — Lernen auf Wirkung.
-- Neuer jarvis_reports-Kind "wirkung" für den wöchentlichen Wirkungsbericht (akquise_wirkungsbericht):
-- Antwort-/Bewerbungsraten je Nachrichten-Variante, rein lesend, nie automatisch verschickt.
alter table public.jarvis_reports drop constraint if exists jarvis_reports_kind_check;
alter table public.jarvis_reports add constraint jarvis_reports_kind_check
  check (kind in ('morgen', 'woche', 'recherche', 'antwort', 'diagnose', 'dossier', 'regie', 'wissen', 'zeitgeist', 'markenaufbau', 'wirtschaft', 'jagd', 'wirkung'));
