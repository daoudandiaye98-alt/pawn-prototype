
-- Designer editorial fields
ALTER TABLE public.designers 
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS quote_role text,
  ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Curated collections
CREATE TABLE IF NOT EXISTS public.curated_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  title text NOT NULL,
  subtitle text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curated_collections TO anon, authenticated;
GRANT ALL ON public.curated_collections TO service_role;
ALTER TABLE public.curated_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active collections" ON public.curated_collections FOR SELECT USING (is_active = true);
CREATE POLICY "admin all collections" ON public.curated_collections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.curated_collections(id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  world text,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collection_items TO anon, authenticated;
GRANT ALL ON public.collection_items TO service_role;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read items" ON public.collection_items FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.curated_collections c WHERE c.id = collection_id AND c.is_active = true)
);
CREATE POLICY "admin all items" ON public.collection_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Extend event allowlist for taste signals
CREATE OR REPLACE FUNCTION public.enforce_event_role_allowlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  admin_types text[] := ARRAY[
    'designer.approved','designer.rejected','designer.archived','designer.reviewed','designer.note_added',
    'ai.prompt_updated','ai.agent_configured','ai.tool_enabled','ai.tool_disabled',
    'policy.updated','plugin.registered','plugin.enabled','plugin.disabled',
    'broadcast.sent','mutation.ratified','audit.written'
  ];
  designer_types text[] := ARRAY[
    'product.registered','collection.registered','product.drafted','product.published','product.updated',
    'designer.onboarding_started','designer.onboarding_completed','ai.brand_dna_generated'
  ];
  applicant_types text[] := ARRAY[
    'designer.application_submitted','designer.consent_accepted'
  ];
  open_types text[] := ARRAY[
    'ai.taste_signal','ai.conversation_started'
  ];
BEGIN
  IF NEW.type = ANY(open_types) THEN
    RETURN NEW;
  END IF;
  IF NEW.actor = 'system' AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: system actor requires admin' USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(admin_types) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: % requires admin', NEW.type USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(designer_types) AND NOT (public.has_role(uid, 'designer') OR public.has_role(uid, 'admin')) THEN
    RAISE EXCEPTION 'event_role_denied: % requires designer', NEW.type USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(applicant_types)
     AND NOT (public.has_role(uid,'designer_applicant') OR public.has_role(uid,'designer') OR public.has_role(uid,'admin')) THEN
    RAISE EXCEPTION 'event_role_denied: % requires designer_applicant', NEW.type USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
