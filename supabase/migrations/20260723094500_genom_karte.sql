-- Teil 7b: Genom-Karte — Fix für eine Regression aus Teil 6b: die
-- jarvis_reports.kind-Constraint wurde beim Erweitern um 'dossier' versehentlich
-- ohne 'wissen' neu geschrieben (seitdem schlägt jeder Wissenslauf-Insert fehl).
-- Wird für die "zuletzt gelernt"-Puls-Zeile der Genom-Karte gebraucht.
-- Constraint wird hier nur um den fehlenden Wert erweitert, nichts entfernt.
ALTER TABLE public.jarvis_reports DROP CONSTRAINT IF EXISTS jarvis_reports_kind_check;
ALTER TABLE public.jarvis_reports ADD CONSTRAINT jarvis_reports_kind_check
  CHECK (kind IN ('morgen', 'woche', 'recherche', 'antwort', 'diagnose', 'dossier', 'regie', 'wissen'));
