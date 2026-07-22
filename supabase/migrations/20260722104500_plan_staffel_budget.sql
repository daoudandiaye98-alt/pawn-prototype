-- Teil 6b: neue Plan-Staffel (Haus/Atelier/Maison), internes KI-Budget je Haus/Monat.
-- Bestehende Abos behalten ihren alten Stripe-Preis — wir überschreiben hier nur die
-- ANZEIGE-Werte (eur_month) für künftige Checkouts, nicht bestehende Stripe-Subscriptions.

UPDATE public.ai_config SET value = '{
  "haus":    { "videos_per_month": 3,  "kinematic_videos_per_month": 0,  "emblem": true,  "signature_previews": 1, "tryon_shots_per_month": 5,  "product_shots_per_month": 5,  "tier": 1 },
  "atelier": { "videos_per_month": 15, "kinematic_videos_per_month": 8,  "emblem": false, "signature_previews": 3, "tryon_shots_per_month": 25, "product_shots_per_month": 25, "tier": 2 },
  "maison":  { "videos_per_month": 40, "kinematic_videos_per_month": 40, "emblem": false, "signature_previews": -1, "tryon_shots_per_month": -1, "product_shots_per_month": -1, "tier": 3 },
  "accent_cost_units": 2,
  "unlimited_plans": ["maison"]
}'::jsonb
WHERE key = 'plan_limits';

INSERT INTO public.ai_config (key, value)
VALUES ('plan_limits', '{
  "haus":    { "videos_per_month": 3,  "kinematic_videos_per_month": 0,  "emblem": true,  "signature_previews": 1, "tryon_shots_per_month": 5,  "product_shots_per_month": 5,  "tier": 1 },
  "atelier": { "videos_per_month": 15, "kinematic_videos_per_month": 8,  "emblem": false, "signature_previews": 3, "tryon_shots_per_month": 25, "product_shots_per_month": 25, "tier": 2 },
  "maison":  { "videos_per_month": 40, "kinematic_videos_per_month": 40, "emblem": false, "signature_previews": -1, "tryon_shots_per_month": -1, "product_shots_per_month": -1, "tier": 3 },
  "accent_cost_units": 2,
  "unlimited_plans": ["maison"]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Neue Preise (24€/99€) nur für künftige Checkouts — bestehende stripe_price_id bleibt unangetastet,
-- damit laufende Abos ihren alten Preis behalten (Stripe-Preise sind nicht nachträglich änderbar;
-- falls schon eine reale stripe_price_id für Atelier/Maison hinterlegt ist, braucht es dafür eine
-- NEUE Stripe-Price zum neuen Betrag — bitte in Stripe anlegen und die ID in ai_config eintragen).
UPDATE public.ai_config SET value = jsonb_set(value, '{atelier,eur_month}', '24')
WHERE key = 'plan_prices';
UPDATE public.ai_config SET value = jsonb_set(value, '{maison,eur_month}', '99')
WHERE key = 'plan_prices';

INSERT INTO public.ai_config (key, value)
VALUES ('plan_prices', '{"atelier": {"eur_month": 24, "stripe_price_id": null}, "maison": {"eur_month": 99, "stripe_price_id": null}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Internes KI-Budget je Haus/Monat — sichtbare Kontingente (oben) sind die vereinfachte
-- Nutzer-Ansicht; hier läuft die tatsächliche Kostenbuchhaltung in Cent.
INSERT INTO public.ai_config (key, value)
VALUES ('ai_budget_limits', '{"haus": 0, "atelier": 700, "maison": 3000}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.ai_config (key, value)
VALUES ('ai_action_costs_cents', '{"broll_clip": 35, "tryon_shot": 12, "tryon_clip": 45, "product_shot": 6}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.ai_budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  month text NOT NULL,
  spent_cents int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id, month)
);

ALTER TABLE public.ai_budget_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own budget" ON public.ai_budget_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = ai_budget_ledger.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "admin manages budget" ON public.ai_budget_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bucht Ist-Kosten (Cent) gegen das Monatsbudget eines Hauses. Blockiert NICHT — die
-- sichtbaren Kontingente (plan_limits) bleiben das durchsetzende Limit; dies ist die
-- zugrundeliegende Kostenwahrheit für Admin/Jarvis-Sicht (AdminKI, künftige Auswertungen).
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

  SELECT COALESCE((value->>_plan)::int, 0) INTO _limit_cents
  FROM public.ai_config WHERE key = 'ai_budget_limits';
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

REVOKE ALL ON FUNCTION public.book_ai_spend(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_ai_spend(uuid, int) TO authenticated, service_role;

-- 'dossier' als künftige Jarvis-Berichtsart (Maison-Haus-Dossier, Teil 6c/später).
ALTER TABLE public.jarvis_reports DROP CONSTRAINT IF EXISTS jarvis_reports_kind_check;
ALTER TABLE public.jarvis_reports ADD CONSTRAINT jarvis_reports_kind_check
  CHECK (kind IN ('morgen', 'woche', 'recherche', 'antwort', 'diagnose', 'dossier'));
