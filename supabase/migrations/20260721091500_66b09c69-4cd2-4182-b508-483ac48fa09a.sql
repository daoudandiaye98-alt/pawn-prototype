-- PAWN Jarvis — Nervensystem: Lauf-Protokoll + Berichte
CREATE TABLE IF NOT EXISTS public.jarvis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('cron','manual')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  summary text,
  tokens_used int NOT NULL DEFAULT 0,
  cost_estimate numeric,
  error text
);
GRANT SELECT ON public.jarvis_runs TO authenticated;
GRANT ALL ON public.jarvis_runs TO service_role;
ALTER TABLE public.jarvis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_runs" ON public.jarvis_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_runs_started_idx ON public.jarvis_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.jarvis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('morgen','woche','recherche','antwort')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
GRANT SELECT ON public.jarvis_reports TO authenticated;
GRANT ALL ON public.jarvis_reports TO service_role;
ALTER TABLE public.jarvis_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_reports" ON public.jarvis_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_reports_created_idx ON public.jarvis_reports (created_at DESC);
