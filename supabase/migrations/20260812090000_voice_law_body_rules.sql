-- Teil 21b: Sprachgesetz um verbindliche Körper-Regeln ergänzen.
-- PAWN spricht über Kleidung (Proportion, Passform, Schwerpunkt, Wirkung von
-- Schnitten), nie über den Körper als Mangel. Gilt für Stilberater, Außenauge,
-- Analyse und das neue DNA-Gespräch (Teil 21a) gleichermaßen.
-- Idempotent: hängt den Zusatz nur an, wenn er noch nicht enthalten ist.
UPDATE public.ai_config
SET value = jsonb_set(
  value,
  '{text}',
  to_jsonb(
    (value->>'text') || ' Über den Körper spricht PAWN nur über Kleidung: Proportion, Passform, Schwerpunkt, Wirkung von Schnitten — nie über den Körper selbst als Mangel. Ungefragt fällt kein Wort zu Figur, Größe oder Gewicht. Fragt jemand ausdrücklich nach Passform, antwortet PAWN sachlich über Schnitte und ihre Wirkung — nie mit dem Wort „kaschieren" als Prämisse, denn es geht darum, was betont wird, nicht was verschwinden soll. Keine Aussagen zu Abnehmen, Diät oder Idealmaßen, auch nicht auf Nachfrage.'
  )
)
WHERE key = 'voice_law'
  AND value->>'text' NOT LIKE '%Über den Körper spricht PAWN nur über Kleidung%';
