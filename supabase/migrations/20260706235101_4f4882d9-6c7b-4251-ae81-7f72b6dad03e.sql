
-- Designer retrospective fields + fortlaufende Haus-Nummer
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS portrait_url       text,
  ADD COLUMN IF NOT EXISTS manifesto          text,
  ADD COLUMN IF NOT EXISTS atelier_image_url  text,
  ADD COLUMN IF NOT EXISTS atelier_caption    text,
  ADD COLUMN IF NOT EXISTS collection_title   text,
  ADD COLUMN IF NOT EXISTS house_number       integer;

CREATE UNIQUE INDEX IF NOT EXISTS designers_house_number_key ON public.designers(house_number) WHERE house_number IS NOT NULL;

-- Backfill: fortlaufende Nummer nach Freigabe-/Erstellungszeit
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.designers
  WHERE house_number IS NULL
)
UPDATE public.designers d
   SET house_number = ordered.rn
  FROM ordered
 WHERE d.id = ordered.id;

-- Nächste Nummer bei approve_designer
CREATE OR REPLACE FUNCTION public.approve_designer(_application_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  app public.designer_applications%ROWTYPE;
  new_designer_id uuid;
  base_slug text;
  final_slug text;
  next_house_no int;
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

  SELECT COALESCE(MAX(house_number), 0) + 1 INTO next_house_no FROM public.designers;

  INSERT INTO public.designers
    (user_id, application_id, slug, brand_name, location, country, website, instagram, story, tags, status, house_number)
  VALUES
    (app.user_id, app.id, final_slug, app.brand_name, app.location, app.country,
     app.website, app.instagram, app.story, app.tags, 'active', next_house_no)
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
                             'user_id', app.user_id,
                             'house_number', next_house_no));

  RETURN new_designer_id;
END;
$function$;
