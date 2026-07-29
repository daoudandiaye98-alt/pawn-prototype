CREATE OR REPLACE FUNCTION public.enqueue_campaign_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.kind = 'video'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.content ? 'asset_url') THEN
    IF EXISTS (SELECT 1 FROM public.posting_queue WHERE campaign_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.posting_queue (campaign_id, channel, scheduled_at, status)
    VALUES (NEW.id, 'pawn_instagram', now(), 'vorschlag');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_posting_suggestion(p_queue_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  slot_day date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  count_on_day int;
  slot_time timestamptz;
  landed_day date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posting_queue WHERE id = p_queue_id AND status = 'vorschlag') THEN
    RETURN;
  END IF;
  LOOP
    SELECT count(*) INTO count_on_day
      FROM public.posting_queue
      WHERE (scheduled_at AT TIME ZONE 'Europe/Berlin')::date = slot_day
        AND status IN ('queued', 'posted');
    IF count_on_day < 3 THEN
      slot_time := (slot_day::timestamp + interval '10 hours' + (count_on_day * interval '4 hours')) AT TIME ZONE 'Europe/Berlin';
      IF slot_time < now() THEN slot_time := now() + interval '2 hours'; END IF;
      landed_day := slot_day;
      EXIT;
    END IF;
    slot_day := slot_day + 1;
  END LOOP;

  UPDATE public.posting_queue SET status = 'queued', scheduled_at = slot_time WHERE id = p_queue_id;
  PERFORM public.resequence_posting_queue_day(landed_day);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_posting_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_posting_suggestion(uuid) TO authenticated;