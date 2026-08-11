-- PART 48 AP4 — Korrektur: pawn-chat und studio-ai unterscheiden bereits seit Teil 37/AP1 DREI
-- Modell-Stufen (haus→standard, atelier→plus, maison→max, siehe PLAN_TIER/PLAN_TO_TIER in beiden
-- Edge Functions) — die erste ai_config.plans-Migration hatte maison versehentlich auf "plus"
-- gesetzt (der Auftragstabelle folgend, die nur zwei Bezahlstufen kannte). Angeglichen an die
-- bereits bestehende, funktionierende Dreiteilung statt sie zu überschreiben.
UPDATE public.ai_config
SET value = jsonb_set(value, '{plaene,maison,model_tier}', '"max"')
WHERE key = 'plans';
