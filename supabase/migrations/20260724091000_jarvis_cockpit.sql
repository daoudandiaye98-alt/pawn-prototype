-- Teil 9a: Jarvis wird das Cockpit — jarvis_runs bekommt eine "mode"-Spalte.
-- Bisher war "trigger" (cron/manual) die einzige Unterscheidung; das reichte
-- nicht, um pro "Organ" (Herzschlag, Wissenslauf, Kurator-Auge, Regisseur …)
-- den letzten echten Lauf zu zeigen. Rein additiv — bestehende Zeilen bleiben
-- mode=NULL und werden im Cockpit ehrlich als "noch kein zugeordneter Lauf"
-- behandelt, nichts wird rückwirkend erfunden.
ALTER TABLE public.jarvis_runs ADD COLUMN IF NOT EXISTS mode text;
