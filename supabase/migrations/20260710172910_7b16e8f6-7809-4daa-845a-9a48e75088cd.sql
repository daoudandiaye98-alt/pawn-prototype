
-- PAWN Actions log
CREATE TABLE IF NOT EXISTS public.ai_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  source text NOT NULL CHECK (source IN ('admin_chat','auto_ontology','system')),
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  before jsonb,
  after jsonb,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('done','undone','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
GRANT SELECT ON public.ai_actions_log TO authenticated;
GRANT ALL ON public.ai_actions_log TO service_role;
ALTER TABLE public.ai_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read actions" ON public.ai_actions_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS ai_actions_log_created_idx ON public.ai_actions_log (created_at DESC);

-- Learned flag on ontology
ALTER TABLE public.fashion_ontology
  ADD COLUMN IF NOT EXISTS learned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS fashion_ontology_learned_idx ON public.fashion_ontology (learned) WHERE learned = true;

-- Provider chain default
INSERT INTO public.ai_config (key, value, updated_by)
VALUES ('provider_priority', jsonb_build_object('chain', jsonb_build_array('openai','anthropic','lovable_gateway','fallback')), NULL)
ON CONFLICT (key) DO NOTHING;
