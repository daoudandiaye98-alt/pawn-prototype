-- PAWN Jarvis — Teil 2: Gedächtnis, Herzschlag, Rails

-- TIER 4 — Gedächtnis: was Jarvis sich merkt (remember/recall)
CREATE TABLE IF NOT EXISTS public.jarvis_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT ON public.jarvis_memory TO authenticated;
GRANT ALL ON public.jarvis_memory TO service_role;
ALTER TABLE public.jarvis_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_memory" ON public.jarvis_memory
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_memory_created_idx ON public.jarvis_memory (created_at DESC);

-- TIER 5 — Herzschlag: Meldungen, die Jarvis von sich aus bemerkt
CREATE TABLE IF NOT EXISTS public.jarvis_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);
GRANT SELECT ON public.jarvis_notices TO authenticated;
GRANT ALL ON public.jarvis_notices TO service_role;
ALTER TABLE public.jarvis_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_notices" ON public.jarvis_notices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Admin darf Meldungen wegklicken (dismissed_at setzen)
CREATE POLICY "admin update jarvis_notices" ON public.jarvis_notices
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_notices_created_idx ON public.jarvis_notices (created_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_notices_unseen_idx ON public.jarvis_notices (kind) WHERE dismissed_at IS NULL;

-- TIER 6 — Rails: Bestätigungsschranke für folgenreiche Aktionen
CREATE TABLE IF NOT EXISTS public.jarvis_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','expired','failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT ON public.jarvis_pending_actions TO authenticated;
GRANT ALL ON public.jarvis_pending_actions TO service_role;
ALTER TABLE public.jarvis_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read jarvis_pending_actions" ON public.jarvis_pending_actions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS jarvis_pending_actions_status_idx ON public.jarvis_pending_actions (status, created_at DESC);

-- Jarvis-Konfiguration (Pausieren-Schalter, Monatslimit, Herzschlag-Einstellungen) lebt in ai_config,
-- Zeile wird beim ersten Zugriff mit Standardwerten angelegt (siehe pawn-jarvis Edge Function).
