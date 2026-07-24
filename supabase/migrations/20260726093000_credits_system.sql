-- Teil 11a: Credits als sichtbare Währung. Ersetzt videos_per_month, kinematic_videos_per_month,
-- tryon_shots_per_month, product_shots_per_month aus ai_config.plan_limits (signature_previews,
-- emblem, tier bleiben dort unangetastet — die betreffen keine Credits). Das bestehende, unsichtbare
-- Kosten-Budget (ai_config.ai_budget_limits, ai_budget_ledger, book_ai_spend) bleibt unverändert als
-- interne Kostenwahrheit für Admin/Jarvis — Credits sind die neue, EINZIGE sichtbare Einheit für Häuser.

-- Was jede Handlung kostet, editierbar unter /admin/ki, nichts hart im Code.
INSERT INTO public.ai_config (key, value)
VALUES ('credit_costs', '{
  "product_shot": 1,
  "tryon_shot": 2,
  "tryon_clip": 8,
  "clip_standard": 5,
  "clip_premium": 12
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Monatsguthaben je Plan — verfällt am Monatsende, wird nicht mitgenommen.
INSERT INTO public.ai_config (key, value)
VALUES ('plan_credits', '{"haus": 30, "atelier": 300, "maison": 1200}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Nachkaufbare Pakete — Stripe-Preis-IDs bleiben leer, bis sie in Stripe angelegt und hier
-- eingetragen werden; bis dahin bleibt der Kauf-Knopf im Studio auf "bald verfügbar".
INSERT INTO public.ai_config (key, value)
VALUES ('credit_packs', '[
  {"id": "pack_100",  "credits": 100,  "eur": 9,   "stripe_price_id": null},
  {"id": "pack_500",  "credits": 500,  "eur": 39,  "stripe_price_id": null},
  {"id": "pack_2000", "credits": 2000, "eur": 129, "stripe_price_id": null}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Die vier ersetzten Zählwerte aus plan_limits entfernen — signature_previews/emblem/tier bleiben.
UPDATE public.ai_config
SET value = value
  #- '{haus,videos_per_month}' #- '{haus,kinematic_videos_per_month}'
  #- '{haus,tryon_shots_per_month}' #- '{haus,product_shots_per_month}'
  #- '{atelier,videos_per_month}' #- '{atelier,kinematic_videos_per_month}'
  #- '{atelier,tryon_shots_per_month}' #- '{atelier,product_shots_per_month}'
  #- '{maison,videos_per_month}' #- '{maison,kinematic_videos_per_month}'
  #- '{maison,tryon_shots_per_month}' #- '{maison,product_shots_per_month}'
WHERE key = 'plan_limits';

-- Credits je Haus/Monat: Guthaben, Verbrauch, Verlauf jeder Handlung mit Zeitpunkt/Modell/Kosten.
CREATE TABLE public.credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  month text NOT NULL,
  balance int NOT NULL DEFAULT 0,
  consumed int NOT NULL DEFAULT 0,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id, month)
);

GRANT SELECT ON public.credits_ledger TO authenticated;
GRANT ALL ON public.credits_ledger TO service_role;
ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own credits" ON public.credits_ledger FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = credits_ledger.designer_id AND d.user_id = auth.uid())
  );

-- Bucht (oder prüft nur, _check_only=true) Credits gegen das Monatsguthaben eines Hauses.
-- Legt die Monatszeile beim ersten Aufruf mit dem vollen Guthaben der aktuellen Plan-Stufe an
-- (Bestandsabos erhalten so automatisch das Guthaben ihrer Stufe, unabhängig vom Stripe-Preis).
CREATE OR REPLACE FUNCTION public.book_credit_spend(
  _designer_id uuid, _action text, _credits int, _model text DEFAULT NULL, _check_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _grant int;
  _month text := to_char(now(), 'YYYY-MM');
  _balance int;
BEGIN
  SELECT plan::text INTO _plan FROM public.designers WHERE id = _designer_id;
  IF _plan IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'designer_not_found');
  END IF;

  SELECT COALESCE((value->>_plan)::int, 0) INTO _grant FROM public.ai_config WHERE key = 'plan_credits';
  _grant := COALESCE(_grant, 0);

  INSERT INTO public.credits_ledger (designer_id, month, balance, consumed, history)
  VALUES (_designer_id, _month, _grant, 0, '[]'::jsonb)
  ON CONFLICT (designer_id, month) DO NOTHING;

  SELECT balance INTO _balance FROM public.credits_ledger
  WHERE designer_id = _designer_id AND month = _month;

  IF _balance < _credits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_credits', 'balance', _balance, 'needed', _credits);
  END IF;

  IF _check_only THEN
    RETURN jsonb_build_object('ok', true, 'balance', _balance, 'needed', _credits);
  END IF;

  UPDATE public.credits_ledger
  SET balance = balance - _credits,
      consumed = consumed + _credits,
      history = history || jsonb_build_object('at', now(), 'action', _action, 'model', _model, 'credits', -_credits),
      updated_at = now()
  WHERE designer_id = _designer_id AND month = _month
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'balance', _balance);
END;
$$;

REVOKE ALL ON FUNCTION public.book_credit_spend(uuid, text, int, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_credit_spend(uuid, text, int, text, boolean) TO authenticated, service_role;

-- Schreibt gekaufte Credits gut (Stripe-Kauf, Teil 11a) — legt die Monatszeile bei Bedarf mit dem
-- normalen Plan-Guthaben an und addiert den Kauf obendrauf.
CREATE OR REPLACE FUNCTION public.grant_credits(_designer_id uuid, _credits int, _note text DEFAULT 'kauf')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _grant int;
  _month text := to_char(now(), 'YYYY-MM');
  _balance int;
BEGIN
  SELECT plan::text INTO _plan FROM public.designers WHERE id = _designer_id;
  IF _plan IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'designer_not_found');
  END IF;

  SELECT COALESCE((value->>_plan)::int, 0) INTO _grant FROM public.ai_config WHERE key = 'plan_credits';
  _grant := COALESCE(_grant, 0);

  INSERT INTO public.credits_ledger (designer_id, month, balance, consumed, history)
  VALUES (_designer_id, _month, _grant, 0, '[]'::jsonb)
  ON CONFLICT (designer_id, month) DO NOTHING;

  UPDATE public.credits_ledger
  SET balance = balance + _credits,
      history = history || jsonb_build_object('at', now(), 'action', _note, 'model', null, 'credits', _credits),
      updated_at = now()
  WHERE designer_id = _designer_id AND month = _month
  RETURNING balance INTO _balance;

  RETURN jsonb_build_object('ok', true, 'balance', _balance);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_credits(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, int, text) TO service_role;
