-- PART "Die ersten Fünfzig" · WP1 — das Rückgrat: Attribution Ende-zu-Ende.
-- Jeder Lead bekommt einen kurzen, URL-tauglichen ref_code; jede Bewerbung kann darüber
-- ihrem Ursprungs-Lead zugeordnet werden, und der Lead-Status spiegelt das wider.

-- 1. generate_ref_code() — 6-stelliger Code aus einem Alphabet ohne verwechselbare Zeichen
-- (kein 0/O, 1/I/l), kollisionsfrei geprüft gegen bestehende Codes.
CREATE OR REPLACE FUNCTION public.generate_ref_code()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.acquisition_leads WHERE ref_code = code);
  END LOOP;
  RETURN code;
END;
$function$;

-- 2. Neue Spalten (Gesetz 7: idempotent, IF NOT EXISTS)
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS ref_code text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_channel text,
  ADD COLUMN IF NOT EXISTS reply_sentiment text,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS variant_id text,
  ADD COLUMN IF NOT EXISTS recherche_attempted_at timestamptz,
  -- Eigene Spalte statt Zweckentfremdung von decided_at (das die Kuratoren-Entscheidung
  -- meint, nicht die Bewerbung) — Ehrlichkeitsgesetz: ein Feld, eine Bedeutung.
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE public.acquisition_leads
  DROP CONSTRAINT IF EXISTS acquisition_leads_reply_sentiment_check;
ALTER TABLE public.acquisition_leads
  ADD CONSTRAINT acquisition_leads_reply_sentiment_check
  CHECK (reply_sentiment IS NULL OR reply_sentiment IN ('positiv', 'neutral', 'negativ'));

-- 3. Backfill: alle Bestandsleads bekommen sofort einen Code.
UPDATE public.acquisition_leads SET ref_code = public.generate_ref_code() WHERE ref_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS acquisition_leads_ref_code_key ON public.acquisition_leads (ref_code);

-- 4. Trigger: jeder neue Lead bekommt beim Anlegen automatisch einen Code — kein Backfill-
-- Nachlauf mehr nötig, das Rückgrat trägt von Anfang an.
CREATE OR REPLACE FUNCTION public.set_lead_ref_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.ref_code IS NULL THEN
    NEW.ref_code := public.generate_ref_code();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS acquisition_leads_ref_code_trigger ON public.acquisition_leads;
CREATE TRIGGER acquisition_leads_ref_code_trigger
  BEFORE INSERT ON public.acquisition_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_ref_code();

-- 5. Bestehende Drafts (Diagnose: 174 Stück) bekommen ihren persönlichen Link nachträglich
-- angehängt, statt neu verfasst zu werden — günstiger und ohne KI-Aufruf. Neue Drafts
-- (akquise_verfassen/akquise_dm_vorbereiten, Edge-Function-Änderung in diesem Auftrag)
-- schreiben den Link ab sofort direkt mit.
UPDATE public.acquisition_leads
SET message_draft = message_draft || E'\n\nhttps://pawn.vision/einladung/' || ref_code
WHERE message_draft IS NOT NULL
  AND ref_code IS NOT NULL
  AND message_draft NOT LIKE '%/einladung/%';

-- 6. approve_designer: bei Annahme einer Bewerbung mit bekanntem Ursprungs-Lead wandert
-- dessen Status auf 'gewonnen'. Funktionskörper unverändert übernommen aus
-- 20260706235101_4f4882d9-6c7b-4251-ae81-7f72b6dad03e.sql, nur der neue Schritt ergänzt.
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

  -- WP1 "Die ersten Fünfzig": Ursprungs-Lead auf 'gewonnen' setzen, wenn bekannt.
  IF app.acquisition_lead_id IS NOT NULL THEN
    UPDATE public.acquisition_leads SET status = 'gewonnen' WHERE id = app.acquisition_lead_id;
  END IF;

  INSERT INTO public.domain_events (type, actor, payload)
  VALUES ('designer.approved', 'system',
          jsonb_build_object('application_id', _application_id,
                             'designer_id', new_designer_id,
                             'user_id', app.user_id,
                             'house_number', next_house_no));

  RETURN new_designer_id;
END;
$function$;
