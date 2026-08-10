-- Teil 39 AP1
alter table public.designers
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

comment on column public.designers.stripe_subscription_id is
  'Teil 39 AP1: aktuelles Abo bei Stripe (Paid-Plan) — wird von stripe-webhook gepflegt, Grundlage für den Kündigungsbutton.';

alter table public.products
  add column if not exists gpsr_manufacturer_name text,
  add column if not exists gpsr_manufacturer_address text,
  add column if not exists gpsr_eu_responsible text,
  add column if not exists gpsr_safety_warning text;

comment on column public.products.gpsr_manufacturer_name is
  'Teil 39 AP1 (GPSR): Name der Herstellerin/des Herstellers. Optional — wird auf der Produktseite nur angezeigt, wenn gefüllt.';
comment on column public.products.gpsr_eu_responsible is
  'Teil 39 AP1 (GPSR): verantwortliche Person/Firma in der EU, falls Hersteller außerhalb der EU sitzt.';

-- Teil 39 AP3
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS shows_synthetic_person boolean NOT NULL DEFAULT false;

ALTER TABLE public.video_assets
  ADD COLUMN IF NOT EXISTS shows_synthetic_person boolean NOT NULL DEFAULT false;

ALTER TABLE public.posting_queue
  ADD COLUMN IF NOT EXISTS geprueft_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geprueft_am timestamptz;

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

  UPDATE public.posting_queue
    SET status = 'queued', scheduled_at = slot_time, geprueft_von = auth.uid(), geprueft_am = now()
    WHERE id = p_queue_id;
  PERFORM public.resequence_posting_queue_day(landed_day);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_posting_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_posting_suggestion(uuid) TO authenticated;

-- Teil 39 AP4
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS retention_purged_at timestamptz;

UPDATE public.ai_config SET value = jsonb_set(value, '{retention_days}', '180'::jsonb)
WHERE key = 'akquise_config' AND NOT (value ? 'retention_days');

-- Teil 39 AP5
CREATE TABLE public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_hits_bucket_created_idx ON public.rate_limit_hits (bucket, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;
GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE rate_limit_hits_id_seq TO service_role;

INSERT INTO public.ai_config (key, value)
VALUES ('pawn_chat_rate_limits', '{"per_user_per_minute": 20, "per_ip_per_minute": 40}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Teil 39 AP6
UPDATE public.ai_config
SET value = jsonb_set(value, '{zwei_register}', '{
  "beschreibung": "Zwei Sprachregister, bewusst getrennt: Bühne (poetisch) für Flächen, die zeigen/erzählen. Bedienung (Klartext) für Flächen, wo jemand etwas TUN muss oder eine Konsequenz trägt.",
  "buehne": "Playfair-Serif-Ton, darf andeuten statt erklären, Bilder statt Aufzählung. Gilt: Landing-Hero, Welt-Seiten (Mode/Interior/Kunst), Cover-Momente, redaktionelle/editoriale Texte, Marken-Erzählung.",
  "bedienung": "Inter-Ton, ein Satz = eine Handlung oder ein Fakt, nie zweideutig, keine Metapher. Gilt: Formulare, Buttons, Bestätigungen, Einstellungen, alles mit einem Preis/einer Frist/einer Unterschrift.",
  "fehler_formel": "Jede Fehlermeldung besteht aus genau zwei Teilen: (1) was ist passiert, ein Satz, ohne Fachbegriff/Code/Stacktrace; (2) was die Person jetzt tun kann, ein Satz mit einem Verb (nochmal versuchen, uns schreiben, Feld prüfen). Nie nur Teil 1 ohne Teil 2.",
  "geld_vertrag_zusatz": "Auf Geld- und Vertragsflächen gilt Bedienung IMMER, auch innerhalb einer sonst poetischen Bühnen-Umgebung (z.B. die Kaufleiste auf einer Bühnen-Produktseite). Beträge, Fristen, Kündigungsfolgen, Widerrufsrechte werden immer ausgeschrieben, nie angedeutet."
}'::jsonb)
WHERE key = 'voice_law';