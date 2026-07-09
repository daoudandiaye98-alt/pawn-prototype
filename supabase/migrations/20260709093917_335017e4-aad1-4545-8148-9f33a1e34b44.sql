
-- 1) Plan enum + column
CREATE TYPE public.designer_plan AS ENUM ('haus','atelier','maison');
ALTER TABLE public.designers ADD COLUMN plan public.designer_plan NOT NULL DEFAULT 'haus';

-- 2) posting_queue
CREATE TYPE public.posting_channel AS ENUM ('pawn_instagram','pawn_tiktok','pawn_youtube');
CREATE TYPE public.posting_status AS ENUM ('queued','posted','failed','cancelled');

CREATE TABLE public.posting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  channel public.posting_channel NOT NULL DEFAULT 'pawn_instagram',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status public.posting_status NOT NULL DEFAULT 'queued',
  posted_url text,
  posted_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posting_queue_status_scheduled_idx ON public.posting_queue(status, scheduled_at);
CREATE INDEX posting_queue_campaign_idx ON public.posting_queue(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posting_queue TO authenticated;
GRANT ALL ON public.posting_queue TO service_role;
ALTER TABLE public.posting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own queue"
ON public.posting_queue FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c JOIN public.designers d ON d.id = c.designer_id
  WHERE c.id = posting_queue.campaign_id AND d.user_id = auth.uid()
));
CREATE POLICY "admin reads queue"
ON public.posting_queue FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin writes queue"
ON public.posting_queue FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER posting_queue_touch BEFORE UPDATE ON public.posting_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) generation_requests
CREATE TYPE public.generation_tier AS ENUM ('accent','full');
CREATE TYPE public.generation_status AS ENUM ('requested','running','done','failed');

CREATE TABLE public.generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tier public.generation_tier NOT NULL DEFAULT 'accent',
  provider text NOT NULL DEFAULT 'kling',
  status public.generation_status NOT NULL DEFAULT 'requested',
  cost_estimate numeric,
  result_url text,
  error text,
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_requests_campaign_idx ON public.generation_requests(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_requests TO authenticated;
GRANT ALL ON public.generation_requests TO service_role;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own gen requests"
ON public.generation_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c JOIN public.designers d ON d.id = c.designer_id
  WHERE c.id = generation_requests.campaign_id AND d.user_id = auth.uid()
));
CREATE POLICY "designer creates own gen requests"
ON public.generation_requests FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c JOIN public.designers d ON d.id = c.designer_id
  WHERE c.id = generation_requests.campaign_id AND d.user_id = auth.uid()
));
CREATE POLICY "admin all gen requests"
ON public.generation_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER generation_requests_touch BEFORE UPDATE ON public.generation_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) auto-enqueue on campaign approved (fair-share: max 3/day, next free slot)
CREATE OR REPLACE FUNCTION public.enqueue_campaign_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_day date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  count_on_day int;
  slot_time timestamptz;
BEGIN
  IF NEW.status = 'approved' AND NEW.kind = 'video'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.content ? 'asset_url') THEN
    IF EXISTS (SELECT 1 FROM public.posting_queue WHERE campaign_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    LOOP
      SELECT count(*) INTO count_on_day
        FROM public.posting_queue
        WHERE (scheduled_at AT TIME ZONE 'Europe/Berlin')::date = slot_day
          AND status IN ('queued','posted');
      IF count_on_day < 3 THEN
        slot_time := (slot_day::timestamp + interval '10 hours' + (count_on_day * interval '4 hours')) AT TIME ZONE 'Europe/Berlin';
        IF slot_time < now() THEN slot_time := now() + interval '2 hours'; END IF;
        EXIT;
      END IF;
      slot_day := slot_day + 1;
    END LOOP;

    INSERT INTO public.posting_queue (campaign_id, channel, scheduled_at, status)
    VALUES (NEW.id, 'pawn_instagram', slot_time, 'queued');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_enqueue_post
AFTER INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.enqueue_campaign_post();

-- 5) ai_config seeds for plan limits & prices
INSERT INTO public.ai_config (key, value) VALUES
 ('plan_limits', jsonb_build_object(
    'haus', jsonb_build_object('videos_per_month', 2, 'tier', 1),
    'atelier', jsonb_build_object('videos_per_month', 10, 'tier', 2),
    'maison', jsonb_build_object('videos_per_month', 30, 'tier', 3)
 )),
 ('plan_prices', jsonb_build_object(
    'atelier', jsonb_build_object('eur_month', 19, 'stripe_price_id', null),
    'maison', jsonb_build_object('eur_month', 79, 'stripe_price_id', null)
 ))
ON CONFLICT (key) DO NOTHING;
