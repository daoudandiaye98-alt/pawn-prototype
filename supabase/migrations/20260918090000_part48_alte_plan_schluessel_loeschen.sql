-- PART 48 — Aufräumen: Die vier alten Konfigurationsschlüssel sind jetzt vollständig durch
-- ai_config.plans ersetzt. Geprüft (Volltext-Grep über src/ und supabase/functions/): keine
-- Codestelle liest plan_prices, plan_limits, plan_credits oder ai_budget_limits mehr —
-- book_ai_spend/book_credit_spend/grant_credits lesen bereits aus ai_config.plans (vorige
-- Migration), StudioPlan.tsx/quota.ts/AdminKI.tsx/generate-broll/generate-signatures/
-- pawn-actions/pawn-jarvis wurden umgestellt. credit_costs/credit_packs (die Kosten-Tabellen
-- der weiterhin bestehenden Credits-Kasse) sind NICHT Teil dieser vier Schlüssel und bleiben
-- unverändert bestehen.
DELETE FROM public.ai_config WHERE key IN ('plan_prices', 'plan_limits', 'plan_credits', 'ai_budget_limits');
