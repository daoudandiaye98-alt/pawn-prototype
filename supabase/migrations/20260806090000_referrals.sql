-- Teil 17d: Der Reichweiten-Hebel — Cross-House-Referral in Credits, nicht in Geld. Jedes Haus
-- bekommt einen Code (dessen eigener Slug — kein neues Feld nötig), den es teilen kann. Wenn
-- jemand darüber neu zu PAWN kommt und die erste Bestellung abschließt (bei irgendeinem Haus,
-- nicht nur beim werbenden), bekommt das werbende Haus eine KI-Credit-Gutschrift. Kein
-- Selbstkauf, keine Gutschrift vor Bestellabschluss — beides serverseitig erzwungen, nie dem
-- Client vertraut.
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  referrer_designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  credited boolean NOT NULL DEFAULT false,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrer_reads_own_referrals" ON public.referrals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = referrer_designer_id AND d.user_id = auth.uid())
);

-- Wie viele Credits eine erfolgreiche Empfehlung einbringt — editierbar in ai_config, nicht
-- hart verdrahtet (Teil-17-Grundregel).
INSERT INTO public.ai_config (key, value)
VALUES ('referral_program', '{"credits": 20}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Einzige Schreibstelle für referrals — prüft serverseitig alles, was der Client nicht
-- fälschen darf: die Bestellung gehört wirklich dem aufrufenden Nutzer und ist bezahlt, das
-- werbende Haus existiert, es ist kein Selbstkauf, und der Nutzer wurde noch nie zuvor
-- geworben (erste Bestellung = einmalige Gutschrift). Ruft intern grant_credits auf, das
-- selbst nur für service_role freigegeben ist — als SECURITY DEFINER läuft dieser Aufruf mit
-- den Rechten des Funktionsbesitzers, nicht des aufrufenden Nutzers.
CREATE OR REPLACE FUNCTION public.grant_referral_credit(p_order_id uuid, p_ref_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_referrer RECORD;
  v_amount integer;
BEGIN
  IF p_ref_code IS NULL OR length(trim(p_ref_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = auth.uid() AND status = 'paid';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_paid');
  END IF;

  SELECT * INTO v_referrer FROM public.designers WHERE slug = p_ref_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referrer_not_found');
  END IF;

  IF v_referrer.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT COALESCE((value->>'credits')::int, 20) INTO v_amount FROM public.ai_config WHERE key = 'referral_program';

  INSERT INTO public.referrals (code, referrer_designer_id, referred_user_id, first_order_id, credited, credited_at)
  VALUES (p_ref_code, v_referrer.id, auth.uid(), p_order_id, true, now());

  PERFORM public.grant_credits(v_referrer.id, v_amount, 'referral_bonus');

  RETURN jsonb_build_object('ok', true, 'amount', v_amount);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
END;
$$;

REVOKE ALL ON FUNCTION public.grant_referral_credit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_referral_credit(uuid, text) TO authenticated;
