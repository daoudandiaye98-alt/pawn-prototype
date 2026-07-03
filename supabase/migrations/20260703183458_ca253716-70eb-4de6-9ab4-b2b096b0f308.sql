
-- =========================================================================
-- PAWN · Designer Application Pipeline · Foundation Migration
-- Adds: role 'designer_applicant', 5 tables, event-allowlist, approve function
-- =========================================================================

-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'designer_applicant';

-- 2. contract_versions ------------------------------------------------------
CREATE TABLE public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  version int NOT NULL,
  title text NOT NULL,
  body_markdown text NOT NULL,
  checksum text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version)
);
GRANT SELECT ON public.contract_versions TO anon, authenticated;
GRANT ALL ON public.contract_versions TO service_role;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts readable by all" ON public.contract_versions FOR SELECT USING (true);
CREATE POLICY "contracts admin write" ON public.contract_versions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. designer_applications --------------------------------------------------
CREATE TABLE public.designer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  legal_name text,
  location text,
  country text,
  website text,
  instagram text,
  story text,
  tags text[] DEFAULT '{}',
  production_status text,
  avatar_path text,
  banner_path text,
  portfolio_paths text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','in_review','approved','rejected','archived')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  admin_notes text,
  rejection_reason text,
  ai_review_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX ON public.designer_applications (status);
CREATE INDEX ON public.designer_applications (submitted_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.designer_applications TO authenticated;
GRANT ALL ON public.designer_applications TO service_role;
ALTER TABLE public.designer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applicant reads own" ON public.designer_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admin reads all applications" ON public.designer_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "applicant inserts own" ON public.designer_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applicant updates draft" ON public.designer_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft','submitted'))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin updates any" ON public.designer_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_designer_applications_updated
  BEFORE UPDATE ON public.designer_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. designer_consents ------------------------------------------------------
CREATE TABLE public.designer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.designer_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_version_id uuid NOT NULL REFERENCES public.contract_versions(id),
  checksum_at_accept text NOT NULL,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, contract_version_id)
);
CREATE INDEX ON public.designer_consents (user_id);
GRANT SELECT, INSERT ON public.designer_consents TO authenticated;
GRANT ALL ON public.designer_consents TO service_role;
ALTER TABLE public.designer_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents self read" ON public.designer_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "consents self insert" ON public.designer_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. designers (public marketplace projection) ------------------------------
CREATE TABLE public.designers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  brand_name text NOT NULL,
  location text,
  country text,
  website text,
  instagram text,
  story text,
  tags text[] DEFAULT '{}',
  avatar_url text,
  banner_url text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.designers (published);
GRANT SELECT ON public.designers TO anon, authenticated;
GRANT UPDATE ON public.designers TO authenticated;
GRANT ALL ON public.designers TO service_role;
ALTER TABLE public.designers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "designers public read" ON public.designers FOR SELECT USING (published = true);
CREATE POLICY "designer reads own" ON public.designers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "designer updates own" ON public.designers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manages designers" ON public.designers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_designers_updated
  BEFORE UPDATE ON public.designers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. designer_onboarding_sessions ------------------------------------------
CREATE TABLE public.designer_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete')),
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.designer_onboarding_sessions TO authenticated;
GRANT ALL ON public.designer_onboarding_sessions TO service_role;
ALTER TABLE public.designer_onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding self access" ON public.designer_onboarding_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_onboarding_updated
  BEFORE UPDATE ON public.designer_onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. designer_brand_dna -----------------------------------------------------
CREATE TABLE public.designer_brand_dna (
  designer_id uuid PRIMARY KEY REFERENCES public.designers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_dna jsonb,
  brand_voice jsonb,
  marketing_dna jsonb,
  audience_profile jsonb,
  color_palette jsonb,
  storytelling jsonb,
  campaign_style jsonb,
  prompt_library jsonb,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active')),
  generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.designer_brand_dna TO authenticated;
GRANT ALL ON public.designer_brand_dna TO service_role;
ALTER TABLE public.designer_brand_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand dna self access" ON public.designer_brand_dna FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_brand_dna_updated
  BEFORE UPDATE ON public.designer_brand_dna
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Storage RLS for bucket 'designer-applications' -------------------------
CREATE POLICY "applicant upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'designer-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "applicant reads own folder" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'designer-applications'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "applicant updates own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'designer-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "applicant deletes own folder" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'designer-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 9. Extend enforce_event_role_allowlist with new event types --------------
CREATE OR REPLACE FUNCTION public.enforce_event_role_allowlist()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
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
$$;

-- 10. handle_new_user extended: honors intent='designer' from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  IF NEW.raw_user_meta_data->>'intent' = 'designer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'designer_applicant')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 11. slug helper -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(lower(coalesce(txt,'')), '[^a-z0-9]+', '-', 'g'),
           '(^-+|-+$)', '', 'g'
         );
$$;

-- 12. approve_designer(uuid) -----------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_designer(_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  app public.designer_applications%ROWTYPE;
  new_designer_id uuid;
  base_slug text;
  final_slug text;
  n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO app FROM public.designer_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF app.status = 'approved' THEN RAISE EXCEPTION 'already_approved'; END IF;

  base_slug := public.slugify(app.brand_name);
  IF base_slug = '' THEN base_slug := 'studio'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.designers WHERE slug = final_slug) LOOP
    n := n + 1;
    final_slug := base_slug || '-' || n;
  END LOOP;

  INSERT INTO public.designers (user_id, slug, brand_name, location, country, website, instagram, story, tags)
  VALUES (app.user_id, final_slug, app.brand_name, app.location, app.country, app.website, app.instagram, app.story, app.tags)
  RETURNING id INTO new_designer_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (app.user_id, 'designer') ON CONFLICT DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = app.user_id AND role = 'designer_applicant';

  INSERT INTO public.designer_onboarding_sessions (designer_id, user_id, status)
  VALUES (new_designer_id, app.user_id, 'pending')
  ON CONFLICT (designer_id) DO NOTHING;

  UPDATE public.designer_applications
     SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _application_id;

  INSERT INTO public.domain_events (type, actor, payload)
  VALUES ('designer.approved', 'system',
          jsonb_build_object('application_id', _application_id, 'designer_id', new_designer_id, 'user_id', app.user_id));

  RETURN new_designer_id;
END;
$$;

-- 13. reject_designer(uuid, text) ------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_designer(_application_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.designer_applications
     SET status = 'rejected', rejection_reason = _reason,
         reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _application_id;

  INSERT INTO public.domain_events (type, actor, payload)
  VALUES ('designer.rejected', 'system',
          jsonb_build_object('application_id', _application_id, 'reason', _reason));
END;
$$;

-- 14. archive_application(uuid) --------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_application(_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.designer_applications
     SET status = 'archived', reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _application_id;

  INSERT INTO public.domain_events (type, actor, payload)
  VALUES ('designer.archived', 'system', jsonb_build_object('application_id', _application_id));
END;
$$;

-- 15. Seed initial contract versions ---------------------------------------
INSERT INTO public.contract_versions (kind, version, title, body_markdown, checksum) VALUES
  ('designer_terms', 1, 'PAWN Designer Terms',
   E'# PAWN Designer Terms\n\nBy joining PAWN as a designer, you agree to present your work through our curated marketplace, uphold quality standards, and honor customer commitments. PAWN reserves the right to remove listings that violate community guidelines.',
   md5('designer_terms_v1_2026')),
  ('commission', 1, 'Revenue Share',
   E'# Revenue Share\n\nPAWN retains a platform fee on each transaction. The remainder is paid out to your linked account on a recurring schedule. Fees may change with 30 days notice; existing orders honor the fee at time of sale.',
   md5('commission_v1_2026')),
  ('ai_marketing', 1, 'AI Marketing Consent',
   E'# AI Marketing Consent\n\nYou grant PAWN the right to analyze your brand assets and generate marketing material on your behalf. All published material requires your explicit approval before going live. You may revoke this consent at any time.',
   md5('ai_marketing_v1_2026'))
ON CONFLICT (kind, version) DO NOTHING;
