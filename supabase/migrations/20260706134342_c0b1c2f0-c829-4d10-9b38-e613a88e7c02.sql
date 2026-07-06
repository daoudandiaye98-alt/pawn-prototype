
-- =========================================================================
-- CAMPAIGNS
-- =========================================================================
CREATE TYPE public.campaign_kind AS ENUM ('video', 'post', 'text');
CREATE TYPE public.campaign_status AS ENUM (
  'draft', 'proposed', 'in_review', 'changes_requested', 'approved', 'published', 'declined'
);

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id UUID NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind public.campaign_kind NOT NULL DEFAULT 'post',
  status public.campaign_status NOT NULL DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB[] NOT NULL DEFAULT ARRAY[]::JSONB[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaigns_designer_id_idx ON public.campaigns(designer_id);
CREATE INDEX campaigns_status_idx ON public.campaigns(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Designers read own campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = campaigns.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "Designers update own campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = campaigns.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = campaigns.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "Admins manage campaigns"
  ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================================
-- EVENT ALLOWLIST: add campaign.* + notification.*
-- =========================================================================
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
    'broadcast.sent','mutation.ratified','audit.written',
    'campaign.proposed','campaign.declined_by_admin'
  ];
  designer_types text[] := ARRAY[
    'product.registered','collection.registered','product.drafted','product.published','product.updated',
    'designer.onboarding_started','designer.onboarding_completed','ai.brand_dna_generated',
    'campaign.approved','campaign.changes_requested','campaign.published'
  ];
  applicant_types text[] := ARRAY[
    'designer.application_submitted','designer.consent_accepted'
  ];
  open_types text[] := ARRAY[
    'ai.taste_signal','ai.conversation_started'
  ];
BEGIN
  IF NEW.type = ANY(open_types) THEN RETURN NEW; END IF;
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

-- =========================================================================
-- AUTO-NOTIFICATIONS via triggers
-- =========================================================================

-- Helper: insert a notification (called from triggers with service-definer)
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, _type, _title, _body, _link FROM public.user_roles ur WHERE ur.role = 'admin';
END; $$;

-- On new application → notify admins
CREATE OR REPLACE FUNCTION public.on_application_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM public.notify_admins(
      'application.submitted',
      'Neue Bewerbung: ' || COALESCE(NEW.brand_name, 'Unbenannt'),
      'Eine neue Designer-Bewerbung wartet auf Prüfung.',
      '/admin/designers'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_application_submitted
AFTER INSERT OR UPDATE OF status ON public.designer_applications
FOR EACH ROW EXECUTE FUNCTION public.on_application_submitted();

-- On application status change (approved/rejected) → notify applicant
CREATE OR REPLACE FUNCTION public.on_application_decided()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','rejected') AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'application.' || NEW.status,
      CASE WHEN NEW.status = 'approved'
        THEN 'Willkommen bei PAWN.'
        ELSE 'Deine Bewerbung wurde nicht angenommen.' END,
      CASE WHEN NEW.status = 'approved'
        THEN 'Dein Studio ist bereit. Öffne /studio, um zu starten.'
        ELSE COALESCE(NEW.rejection_reason, 'Wir haben uns diesmal für eine andere Handschrift entschieden.') END,
      CASE WHEN NEW.status = 'approved' THEN '/studio' ELSE '/apply' END
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_application_decided
AFTER UPDATE OF status ON public.designer_applications
FOR EACH ROW EXECUTE FUNCTION public.on_application_decided();

-- On campaign status change → notify + emit event
CREATE OR REPLACE FUNCTION public.on_campaign_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  designer_user uuid;
  event_type text;
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT user_id INTO designer_user FROM public.designers WHERE id = NEW.designer_id;
    event_type := 'campaign.' || NEW.status::text;

    -- Notify designer on proposed
    IF NEW.status = 'proposed' AND designer_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (designer_user, 'campaign.proposed',
              'Neuer Kampagnenvorschlag: ' || NEW.title,
              'Prüfe den Vorschlag und gib ihn frei oder wünsche Änderungen.',
              '/studio/kampagnen');
    END IF;

    -- Notify admins on designer decision
    IF NEW.status IN ('approved','changes_requested','declined') THEN
      PERFORM public.notify_admins(
        'campaign.' || NEW.status::text,
        'Kampagne "' || NEW.title || '": ' || NEW.status::text,
        'Statusänderung durch Designer.',
        '/admin/kampagnen'
      );
    END IF;

    -- Emit domain event (best-effort; skip when RLS forbids)
    BEGIN
      INSERT INTO public.domain_events (type, actor, payload)
      VALUES (event_type,
              CASE WHEN auth.uid() IS NULL THEN 'system' ELSE auth.uid()::text END,
              jsonb_build_object('campaign_id', NEW.id, 'designer_id', NEW.designer_id, 'title', NEW.title));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_campaign_status_change
AFTER INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.on_campaign_status_change();

-- =========================================================================
-- STORAGE POLICIES for `designer-media`
-- Path convention: `<user_id>/<...>` — the first segment must equal auth.uid().
-- =========================================================================

CREATE POLICY "Designers read own media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'designer-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Designers upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'designer-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Designers update own media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'designer-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Designers delete own media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'designer-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public can view (for published product/brand images referenced by URL). Since
-- bucket is private, we serve via signed URLs in the client on demand.
CREATE POLICY "Public read published designer-media by signed URL"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'designer-media');
