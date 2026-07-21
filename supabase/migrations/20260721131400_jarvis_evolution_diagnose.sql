-- PAWN Jarvis — Teil 3: Evolutions-Kreislauf + Diagnose-Berichte

-- TIER: Evolution — Hypothesen, die Jarvis selbst testet und einzeln rückgängig machen kann
CREATE TABLE IF NOT EXISTS public.jarvis_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis text NOT NULL,
  changed_key text NOT NULL,
  before jsonb,
  after jsonb,
  metric text NOT NULL,
  baseline numeric,
  result numeric,
  status text NOT NULL DEFAULT 'laufend' CHECK (status IN ('laufend','behalten','verworfen')),
  started_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz
);
GRANT SELECT ON public.jarvis_experiments TO authenticated;
GRANT ALL ON public.jarvis_experiments TO service_role;
ALTER TABLE public.jarvis_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_experiments" ON public.jarvis_experiments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_experiments_status_idx ON public.jarvis_experiments (status, started_at DESC);

-- Diagnose-Berichte nutzen dieselbe jarvis_reports-Tabelle, brauchen aber eine neue "kind".
ALTER TABLE public.jarvis_reports DROP CONSTRAINT IF EXISTS jarvis_reports_kind_check;
ALTER TABLE public.jarvis_reports ADD CONSTRAINT jarvis_reports_kind_check
  CHECK (kind IN ('morgen','woche','recherche','antwort','diagnose'));
