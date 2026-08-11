-- PART 47 Befund 1 "Die Verlorenen": Antworten wurden nie erfasst (0 von 47 Mails je replied_at
-- gesetzt). Zwei Bausteine: (1) eine schlanke Prüfspur für eingehende Resend-Mails, die der
-- neue resend-inbound-webhook befüllt, sobald Daouda MX/Subdomain für den Empfang eingerichtet
-- hat — bis dahin bleibt sie leer, das ist ehrlich so. (2) eine SECURITY DEFINER-Funktion, über
-- die ein Mensch im Admin-Bereich JEDE kontaktierte Lead manuell als beantwortet markieren kann,
-- unabhängig davon ob der automatische Kanal je läuft. Schutzregel: die Funktion darf eine Lead
-- nie zurückstufen, die bereits weiter ist (beworben/gewonnen) — sonst identisch zum bestehenden
-- Handgriff in AdminFeldzug.tsx (markReplied), nur wiederverwendbar für die eingehende Mailspur.

CREATE TABLE IF NOT EXISTS public.inbound_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id text UNIQUE,
  from_email text NOT NULL,
  to_email text,
  subject text,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,
  matched_lead_id uuid REFERENCES public.acquisition_leads(id) ON DELETE SET NULL,
  matched_at timestamptz,
  matched_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_email_events_from_idx ON public.inbound_email_events (from_email);
CREATE INDEX IF NOT EXISTS inbound_email_events_matched_idx ON public.inbound_email_events (matched_lead_id);

ALTER TABLE public.inbound_email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all inbound_email_events" ON public.inbound_email_events;
CREATE POLICY "admin all inbound_email_events" ON public.inbound_email_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Eingehende Mails schreibt ausschließlich der Webhook mit dem Service-Key (umgeht RLS ohnehin);
-- keine anon/authenticated-Insert-Policy nötig oder gewollt.

-- Statuswerte, ab denen eine Lead als "weiter als eine reine Antwort" gilt und nicht mehr
-- automatisch/manuell zurück auf 'geantwortet' gesetzt werden soll.
CREATE OR REPLACE FUNCTION public.resolve_inbound_reply(_lead_id uuid, _channel text DEFAULT 'email')
RETURNS TABLE(ok boolean, previous_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'nur Admins dürfen Antworten zuordnen';
  END IF;

  SELECT status INTO _prev FROM public.acquisition_leads WHERE id = _lead_id FOR UPDATE;
  IF _prev IS NULL THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  IF _prev IN ('beworben', 'gewonnen') THEN
    -- schon weiter als eine reine Antwort — nicht zurückstufen, nur den Zeitstempel nachtragen,
    -- falls er fehlt.
    UPDATE public.acquisition_leads
    SET replied_at = COALESCE(replied_at, now()), reply_channel = COALESCE(reply_channel, _channel)
    WHERE id = _lead_id;
    RETURN QUERY SELECT true, _prev;
    RETURN;
  END IF;

  UPDATE public.acquisition_leads
  SET status = 'geantwortet', replied_at = now(), reply_channel = _channel, updated_at = now()
  WHERE id = _lead_id;

  RETURN QUERY SELECT true, _prev;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_inbound_reply(uuid, text) TO authenticated;

-- Manuelle Zuordnung eines eingehenden Mail-Events zu einer Lead (Fallback, solange Resend
-- Inbound nicht per MX eingerichtet ist, und generell als Zweitmeinung neben dem Auto-Matching).
CREATE OR REPLACE FUNCTION public.match_inbound_email(_event_id uuid, _lead_id uuid)
RETURNS TABLE(ok boolean, previous_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'nur Admins dürfen Antworten zuordnen';
  END IF;

  UPDATE public.inbound_email_events
  SET matched_lead_id = _lead_id, matched_at = now(), matched_by = auth.uid()::text
  WHERE id = _event_id;

  SELECT * INTO _result FROM public.resolve_inbound_reply(_lead_id, 'email');
  RETURN QUERY SELECT _result.ok, _result.previous_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_inbound_email(uuid, uuid) TO authenticated;
