
-- Loosen system-event guard so trusted service-role writes (auth.uid() is null) are allowed
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
    'ai.taste_signal','ai.conversation_started',
    'message.sent','order.placed','order.paid','order.failed','payout.profile_updated'
  ];
BEGIN
  IF NEW.type = ANY(open_types) THEN RETURN NEW; END IF;
  IF NEW.actor = 'system' AND uid IS NOT NULL AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: system actor requires admin' USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(admin_types) AND uid IS NOT NULL AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: % requires admin', NEW.type USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(designer_types) AND uid IS NOT NULL AND NOT (public.has_role(uid, 'designer') OR public.has_role(uid, 'admin')) THEN
    RAISE EXCEPTION 'event_role_denied: % requires designer', NEW.type USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(applicant_types) AND uid IS NOT NULL
     AND NOT (public.has_role(uid,'designer_applicant') OR public.has_role(uid,'designer') OR public.has_role(uid,'admin')) THEN
    RAISE EXCEPTION 'event_role_denied: % requires designer_applicant', NEW.type USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ MESSAGE THREADS ============
DO $$ BEGIN
  CREATE TYPE public.message_category AS ENUM ('allgemein','auszahlung','kampagne','produkt','technik');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  subject text NOT NULL,
  category public.message_category NOT NULL DEFAULT 'allgemein',
  status public.message_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.message_threads TO authenticated;
GRANT ALL ON public.message_threads TO service_role;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer sees own threads" ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "designer creates own thread" ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "admin updates any thread" ON public.message_threads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_threads_designer ON public.message_threads(designer_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON public.message_threads(status);

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      JOIN public.designers d ON d.id = t.designer_id
      WHERE t.id = thread_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "participants write messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.message_threads t
        JOIN public.designers d ON d.id = t.designer_id
        WHERE t.id = thread_id AND d.user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at);

-- Realtime for messages + threads
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_threads REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification trigger on new message
CREATE OR REPLACE FUNCTION public.on_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.message_threads%ROWTYPE;
  designer_user uuid;
BEGIN
  SELECT * INTO t FROM public.message_threads WHERE id = NEW.thread_id;
  UPDATE public.message_threads SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.thread_id;
  SELECT user_id INTO designer_user FROM public.designers WHERE id = t.designer_id;

  -- Sender is admin → notify designer
  IF public.has_role(NEW.sender_id, 'admin') THEN
    IF designer_user IS NOT NULL AND designer_user <> NEW.sender_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (designer_user, 'message.received', 'Neue Antwort von PAWN', substring(NEW.body from 1 for 140), '/studio/nachrichten?t=' || t.id);
    END IF;
  ELSE
    -- Designer or other → notify admins
    PERFORM public.notify_admins(
      'message.received',
      'Neue Nachricht: ' || t.subject,
      substring(NEW.body from 1 for 140),
      '/admin/nachrichten?t=' || t.id
    );
  END IF;

  BEGIN
    INSERT INTO public.domain_events (type, actor, payload)
    VALUES ('message.sent',
            CASE WHEN NEW.sender_id IS NULL THEN 'system' ELSE NEW.sender_id::text END,
            jsonb_build_object('thread_id', t.id, 'designer_id', t.designer_id, 'category', t.category));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_after_insert ON public.messages;
CREATE TRIGGER trg_messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_created();

-- ============ ORDERS ============
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount_total integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status public.order_status NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  customer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ============ DESIGNER PAYOUT PROFILES ============
CREATE TABLE IF NOT EXISTS public.designer_payout_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL UNIQUE REFERENCES public.designers(id) ON DELETE CASCADE,
  account_holder text NOT NULL,
  iban text NOT NULL,
  bic text,
  tax_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.designer_payout_profiles TO authenticated;
GRANT ALL ON public.designer_payout_profiles TO service_role;
ALTER TABLE public.designer_payout_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer manages own payout" ON public.designer_payout_profiles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
  );

CREATE TRIGGER trg_payout_updated_at
  BEFORE UPDATE ON public.designer_payout_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
