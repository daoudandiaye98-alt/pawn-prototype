-- Teil 17c: die tägliche Liste erlaubt, einen Vorschlag wegzulegen — er kommt frühestens nach
-- 7 Tagen zurück. Kein Streak-Zähler, keine rote Warnung: nur ein Zeitstempel je Vorschlag-
-- Schlüssel, damit "Weggelegtes" nicht sofort wieder auftaucht. Additiv, kein Constraint wird
-- verschärft.
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS dismissed_suggestions jsonb NOT NULL DEFAULT '{}'::jsonb;
