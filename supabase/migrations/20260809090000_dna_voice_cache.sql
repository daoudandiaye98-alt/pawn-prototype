-- Teil 20b: Speicherort für die generierte Außenauge-Einschätzung je Haus — analog zu
-- brand_dna, damit nicht bei jedem Seitenaufruf neu mit Claude gerechnet wird. Regeneriert
-- nur auf ausdrücklichen Wunsch (Neu einschätzen) oder nach einer Korrektur.
ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS aussenauge jsonb NOT NULL DEFAULT '{}'::jsonb;
