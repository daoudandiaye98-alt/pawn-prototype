CREATE TABLE public.brand_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  world TEXT,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  example TEXT,
  source_url TEXT,
  source_title TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brand_knowledge TO authenticated;
GRANT ALL ON public.brand_knowledge TO service_role;

ALTER TABLE public.brand_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_knowledge_read_approved" ON public.brand_knowledge
FOR SELECT TO authenticated USING (approved = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "brand_knowledge_admin_all" ON public.brand_knowledge
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX brand_knowledge_topic_idx ON public.brand_knowledge (topic);
CREATE INDEX brand_knowledge_approved_idx ON public.brand_knowledge (approved);

CREATE TRIGGER brand_knowledge_touch BEFORE UPDATE ON public.brand_knowledge
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS weekly_impulse BOOLEAN NOT NULL DEFAULT false;