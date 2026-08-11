-- PART 48 — "Eine Wahrheit für Pläne": AP1 (ai_config.plans) + AP2-Fundament (plan_usage,
-- designer_opportunities.sichtbar_ab, designers.plan_seit/plan_bis).
--
-- AP0-Entscheidung (Mensch, nicht Code): Preis-Zeile B — Atelier 19€, Maison 79€, archivierte
-- Stripe-Preise reaktivieren statt neue anzulegen. Die stripe_price_id-Felder unten bleiben
-- deshalb bewusst NULL: die archivierten Preis-IDs liegen nur in Stripe, nicht in dieser
-- Codebase oder in einer Live-DB-Verbindung dieser Sandbox — sie müssen von Hand eingetragen
-- werden (Stripe-Dashboard → Produktkatalog → archivierten Preis wieder aktivieren → price_id
-- kopieren → hier in ai_config.plans.plaene.<plan>.stripe_price_id eintragen). Bis dahin zeigt
-- der Checkout ehrlich "noch nicht eingerichtet" statt zum falschen Preis abzurechnen.
--
-- Abweichung von der AP1-Tabelle im Auftrag (dokumentiert, siehe PR): 'video' und 'tryon'
-- erscheinen hier NICHT als eigene Zähler in limits. Grund: es gibt bereits eine echte,
-- funktionierende Kosten-Kasse dafür (Teil 11a: credits_ledger + book_credit_spend), die
-- unterschiedliche Aktionen unterschiedlich viel kosten lässt (Produktfoto günstiger als
-- Premium-Video) — das wollten wir nicht durch flache Monats-Zähler ersetzen. Die vier
-- zusammengeführten Schlüssel (plan_prices/plan_limits/plan_credits/ai_budget_limits) werden
-- hier durch 'plans' ersetzt; credit_costs/credit_packs (die Kosten-Tabellen der Kasse selbst)
-- bleiben eigene, unverändert bestehende Schlüssel.
INSERT INTO public.ai_config (key, value)
VALUES ('plans', jsonb_build_object(
  'version', 2,
  'plaene', jsonb_build_object(
    'haus', jsonb_build_object(
      'label', 'Haus',
      'eur_month', 0,
      'stripe_price_id', null,
      'model_tier', 'standard',
      'budget_cents_month', 0,
      'credits_per_month', 30,
      'limits', jsonb_build_object(
        'tuer_oeffnen', 1,
        'chat_nachricht', 30,
        'produkte', -1,
        'welten', 1,
        'signature_previews', 1,
        'chat_retrieval', 0,
        'director_loop', 0,
        'dashboard_metriken', 0,
        'sichtbarkeitszug', 0,
        'mini_pawn', 0,
        'marken_kartei', 0,
        'tuer_vorlauf', 0,
        'emblem', 1
      )
    ),
    'atelier', jsonb_build_object(
      'label', 'Atelier',
      'eur_month', 19,
      'stripe_price_id', null,
      'model_tier', 'plus',
      'budget_cents_month', 700,
      'credits_per_month', 300,
      'limits', jsonb_build_object(
        'tuer_oeffnen', 8,
        'chat_nachricht', 300,
        'produkte', -1,
        'welten', 1,
        'signature_previews', 3,
        'chat_retrieval', 1,
        'director_loop', 0,
        'dashboard_metriken', 1,
        'sichtbarkeitszug', 0,
        'mini_pawn', 0,
        'marken_kartei', 0,
        'tuer_vorlauf', 0,
        'emblem', 0
      )
    ),
    'maison', jsonb_build_object(
      'label', 'Maison',
      'eur_month', 79,
      'stripe_price_id', null,
      'model_tier', 'plus',
      'budget_cents_month', 3000,
      'credits_per_month', 1200,
      'limits', jsonb_build_object(
        'tuer_oeffnen', -1,
        'chat_nachricht', 1000,
        'produkte', -1,
        'welten', 3,
        'signature_previews', -1,
        'chat_retrieval', 1,
        'director_loop', 1,
        'dashboard_metriken', 1,
        'sichtbarkeitszug', 1,
        'mini_pawn', 1,
        'marken_kartei', 1,
        'tuer_vorlauf', 1,
        'emblem', 0
      )
    )
  )
))
ON CONFLICT (key) DO NOTHING;

-- AP2-Fundament: Zählwerk je Haus/Funktion/Monat für die 'monat'- und 'bestand'-Grenzen aus
-- ai_config.plans.*.limits. Kein direkter Schreibzugriff für Nutzer — nur über die RPC unten.
CREATE TABLE IF NOT EXISTS public.plan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  feature text NOT NULL,
  periode text NOT NULL,
  anzahl integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id, feature, periode)
);

ALTER TABLE public.plan_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_usage_select_eigene" ON public.plan_usage;
-- Besitzspalte auf designers heißt `user_id`, nicht `owner_id` (Schritt 0 geprüft) — bestehendes
-- Muster wiederverwendet (siehe z.B. RLS auf credits_ledger/ai_budget_ledger), keine zweite Logik.
CREATE POLICY "plan_usage_select_eigene" ON public.plan_usage FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = plan_usage.designer_id AND d.user_id = auth.uid())
  );
-- Kein INSERT/UPDATE/DELETE-Policy für normale Nutzer — geschrieben wird ausschließlich über
-- plan_usage_inkrement (SECURITY DEFINER), gelesen zusätzlich über plan_usage_stand.

GRANT SELECT ON public.plan_usage TO authenticated;
GRANT ALL ON public.plan_usage TO service_role;

-- Atomarer Zähler: erhöht anzahl nur, wenn das Limit noch nicht erreicht ist (p_limit < 0 heißt
-- unbegrenzt). Zwei gleichzeitige Aufrufe zählen um genau 1 hoch, nicht um 2 — die UPDATE-WHERE-
-- Bedingung ist die Sperre, kein separates SELECT-dann-UPDATE.
CREATE OR REPLACE FUNCTION public.plan_usage_inkrement(
  p_designer_id uuid,
  p_feature text,
  p_limit integer
)
RETURNS TABLE (erlaubt boolean, stand integer, limit_wert integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periode text := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM');
  v_stand integer;
BEGIN
  INSERT INTO public.plan_usage (designer_id, feature, periode, anzahl)
  VALUES (p_designer_id, p_feature, v_periode, 0)
  ON CONFLICT (designer_id, feature, periode) DO NOTHING;

  UPDATE public.plan_usage
     SET anzahl = anzahl + 1, updated_at = now()
   WHERE designer_id = p_designer_id
     AND feature = p_feature
     AND periode = v_periode
     AND (p_limit < 0 OR anzahl < p_limit)
  RETURNING anzahl INTO v_stand;

  IF v_stand IS NULL THEN
    SELECT anzahl INTO v_stand FROM public.plan_usage
     WHERE designer_id = p_designer_id AND feature = p_feature AND periode = v_periode;
    RETURN QUERY SELECT false, COALESCE(v_stand, 0), p_limit;
  ELSE
    RETURN QUERY SELECT true, v_stand, p_limit;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.plan_usage_inkrement(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_usage_inkrement(uuid, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.plan_usage_stand(p_designer_id uuid, p_feature text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(anzahl, 0) FROM public.plan_usage
   WHERE designer_id = p_designer_id
     AND feature = p_feature
     AND periode = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM');
$$;

REVOKE ALL ON FUNCTION public.plan_usage_stand(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_usage_stand(uuid, text) TO authenticated, service_role;

-- Türen-Vorlauf: Maison sieht neue Türen sofort, andere Pläne erst nach 48h (Grenze
-- 'tuer_vorlauf'). Bestehende Türen bekommen sichtbar_ab = created_at, damit sie nicht
-- rückwirkend verschwinden.
ALTER TABLE public.designer_opportunities
  ADD COLUMN IF NOT EXISTS sichtbar_ab timestamptz;

UPDATE public.designer_opportunities
   SET sichtbar_ab = created_at
 WHERE sichtbar_ab IS NULL;

-- Stripe-Abo-Zeitraum: bislang gab es keine Spalte, die festhält, seit wann ein Haus im
-- aktuellen Plan ist oder bis wann eine gekündigte Zahlung noch läuft (Teil39AP1 schreibt nur
-- stripe_subscription_id). Für den Lese-Fallback in AP5 (abgelaufen + kein aktives Abo → haus).
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS plan_seit timestamptz,
  ADD COLUMN IF NOT EXISTS plan_bis timestamptz;
