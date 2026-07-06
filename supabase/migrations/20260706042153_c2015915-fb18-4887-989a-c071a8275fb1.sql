
-- 1. Extend designers table with marketplace/admin fields
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.designer_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revenue_share_pct numeric(5,2) NOT NULL DEFAULT 70.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'designers_status_check'
  ) THEN
    ALTER TABLE public.designers
      ADD CONSTRAINT designers_status_check CHECK (status IN ('active','paused'));
  END IF;
END $$;

-- Backfill from legacy `published` flag
UPDATE public.designers SET status = CASE WHEN published THEN 'active' ELSE 'paused' END;

-- Rewrite public read policy to use status
DROP POLICY IF EXISTS "designers public read" ON public.designers;
CREATE POLICY "designers public read" ON public.designers
  FOR SELECT USING (status = 'active');

GRANT SELECT ON public.designers TO anon;

-- Prevent designers from mutating admin-controlled columns
CREATE OR REPLACE FUNCTION public.protect_designer_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := OLD.status;
    NEW.revenue_share_pct := OLD.revenue_share_pct;
    NEW.slug := OLD.slug;
    NEW.application_id := OLD.application_id;
    NEW.user_id := OLD.user_id;
    NEW.published := OLD.published;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_designers_protect ON public.designers;
CREATE TRIGGER trg_designers_protect
  BEFORE UPDATE ON public.designers
  FOR EACH ROW EXECUTE FUNCTION public.protect_designer_admin_columns();

-- 2. approve_designer updated: link application, set status 'active'
CREATE OR REPLACE FUNCTION public.approve_designer(_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.designers
    (user_id, application_id, slug, brand_name, location, country, website, instagram, story, tags, status)
  VALUES
    (app.user_id, app.id, final_slug, app.brand_name, app.location, app.country,
     app.website, app.instagram, app.story, app.tags, 'active')
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
          jsonb_build_object('application_id', _application_id,
                             'designer_id', new_designer_id,
                             'user_id', app.user_id));

  RETURN new_designer_id;
END;
$$;

-- 3. Append-only admin notes
CREATE TABLE IF NOT EXISTS public.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.designer_applications(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_notes_app_created_idx
  ON public.application_notes(application_id, created_at DESC);

GRANT SELECT, INSERT ON public.application_notes TO authenticated;
GRANT ALL ON public.application_notes TO service_role;

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads notes" ON public.application_notes;
CREATE POLICY "admin reads notes" ON public.application_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin writes notes" ON public.application_notes;
CREATE POLICY "admin writes notes" ON public.application_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());

-- 4. RPCs: add a note (append-only, with domain event) and mark under review
CREATE OR REPLACE FUNCTION public.add_application_note(_application_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _body IS NULL OR btrim(_body) = '' THEN
    RAISE EXCEPTION 'empty_note';
  END IF;

  INSERT INTO public.application_notes(application_id, author_id, body)
  VALUES (_application_id, auth.uid(), btrim(_body))
  RETURNING id INTO new_id;

  INSERT INTO public.domain_events(type, actor, payload)
  VALUES ('designer.note_added', 'system',
          jsonb_build_object('application_id', _application_id, 'note_id', new_id));

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_application_in_review(_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.designer_applications
     SET status = 'in_review'
   WHERE id = _application_id AND status = 'submitted';

  IF FOUND THEN
    INSERT INTO public.domain_events(type, actor, payload)
    VALUES ('designer.reviewed', 'system',
            jsonb_build_object('application_id', _application_id));
  END IF;
END;
$$;
