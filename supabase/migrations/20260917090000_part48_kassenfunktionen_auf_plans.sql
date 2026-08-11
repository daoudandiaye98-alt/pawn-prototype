-- PART 48 — Wiring, Teil 1: book_ai_spend/book_credit_spend/grant_credits lesen jetzt aus
-- ai_config.plans statt aus ai_budget_limits/plan_credits. Verhalten bleibt identisch (gleiche
-- Werte, gleiche Rückgabeform) — nur die Quelle wechselt, damit die beiden alten Schlüssel
-- gefahrlos gelöscht werden können, sobald auch die verbleibenden Frontend-Lesestellen
-- (StudioPlan.tsx, quota.ts, AdminKI.tsx) umgestellt sind.

CREATE OR REPLACE FUNCTION public.book_ai_spend(_designer_id uuid, _cents int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _limit_cents int;
  _month text := to_char(now(), 'YYYY-MM');
  _spent int;
BEGIN
  SELECT plan::text INTO _plan FROM public.designers WHERE id = _designer_id;
  IF _plan IS NULL THEN
    RETURN jsonb_build_object('spent_cents', 0, 'limit_cents', 0, 'over_budget', false);
  END IF;

  SELECT COALESCE((value #>> ARRAY['plaene', _plan, 'budget_cents_month'])::int, 0) INTO _limit_cents
  FROM public.ai_config WHERE key = 'plans';
  _limit_cents := COALESCE(_limit_cents, 0);

  INSERT INTO public.ai_budget_ledger (designer_id, month, spent_cents)
  VALUES (_designer_id, _month, 0)
  ON CONFLICT (designer_id, month) DO NOTHING;

  UPDATE public.ai_budget_ledger SET spent_cents = spent_cents + _cents, updated_at = now()
  WHERE designer_id = _designer_id AND month = _month
  RETURNING spent_cents INTO _spent;

  RETURN jsonb_build_object('spent_cents', _spent, 'limit_cents', _limit_cents, 'over_budget', _spent > _limit_cents);
END;
$$;

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

  SELECT COALESCE((value #>> ARRAY['plaene', _plan, 'credits_per_month'])::int, 0) INTO _grant
  FROM public.ai_config WHERE key = 'plans';
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

  SELECT COALESCE((value #>> ARRAY['plaene', _plan, 'credits_per_month'])::int, 0) INTO _grant
  FROM public.ai_config WHERE key = 'plans';
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
