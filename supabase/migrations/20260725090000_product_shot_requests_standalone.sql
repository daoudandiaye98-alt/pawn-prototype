-- Teil 10b: Freisteller (weißer Hintergrund) jetzt auch für Fotos, die im Kampagnen-Studio
-- hochgeladen werden, ohne dass sie an ein konkretes Produkt gebunden sind. product_id war
-- bisher zwingend — reine Lockerung (kein bestehender Constraint wird verschärft oder
-- zurückgesetzt, nur die Pflicht für NEUE Zeilen entfällt); alle bestehenden Zeilen bleiben
-- unverändert mit gesetztem product_id.
ALTER TABLE public.product_shot_requests
  ALTER COLUMN product_id DROP NOT NULL;
