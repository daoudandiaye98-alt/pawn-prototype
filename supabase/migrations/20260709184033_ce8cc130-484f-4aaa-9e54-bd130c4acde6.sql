CREATE OR REPLACE FUNCTION public.plan_priority(_plan public.designer_plan)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'maison' THEN 3 WHEN 'atelier' THEN 2 ELSE 1 END
$$;

CREATE OR REPLACE FUNCTION public.resequence_posting_queue_day(_day date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  slot_idx int := 0;
  base_ts timestamptz;
BEGIN
  FOR r IN
    SELECT pq.id, d.plan, pq.created_at
      FROM public.posting_queue pq
      JOIN public.campaigns c ON c.id = pq.campaign_id
      JOIN public.designers d ON d.id = c.designer_id
     WHERE (pq.scheduled_at AT TIME ZONE 'Europe/Berlin')::date = _day
       AND pq.status = 'queued'
     ORDER BY public.plan_priority(d.plan) DESC, pq.created_at ASC
     LIMIT 3
  LOOP
    base_ts := (_day::timestamp + interval '10 hours' + (slot_idx * interval '4 hours')) AT TIME ZONE 'Europe/Berlin';
    IF base_ts < now() THEN
      base_ts := now() + ((slot_idx + 1) * interval '15 minutes');
    END IF;
    UPDATE public.posting_queue SET scheduled_at = base_ts WHERE id = r.id;
    slot_idx := slot_idx + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_campaign_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  slot_day date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  count_on_day int;
  slot_time timestamptz;
  landed_day date;
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
        landed_day := slot_day;
        EXIT;
      END IF;
      slot_day := slot_day + 1;
    END LOOP;

    INSERT INTO public.posting_queue (campaign_id, channel, scheduled_at, status)
    VALUES (NEW.id, 'pawn_instagram', slot_time, 'queued');

    PERFORM public.resequence_posting_queue_day(landed_day);
  END IF;
  RETURN NEW;
END;
$$;