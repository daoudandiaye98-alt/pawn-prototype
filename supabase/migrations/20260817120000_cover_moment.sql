-- Teil 27b (Der Cover-Moment): einmalige Vollbild-Feier, wenn ein Stück zum ersten Mal live
-- geht, und eine kleinere Fassung, wenn die Hausseite zum ersten Mal veröffentlicht wird.
-- Beide Zeitstempel sind reine Anzeige-Gates — null heißt "noch nicht gezeigt", jeder Wert
-- danach heißt "einmalig gezeigt, nicht wieder zeigen".
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cover_shown_at timestamptz;

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS hausseite_cover_shown_at timestamptz;
