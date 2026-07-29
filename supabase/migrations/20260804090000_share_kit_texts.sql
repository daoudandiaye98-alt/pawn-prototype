-- Teil 17b: Share Kits sind vorlagenbasiert und deterministisch (keine KI, keine Credits,
-- keine Wartezeit) — nur die Bildkomposition ist fest im Code (src/features/share/shareKit.ts),
-- weil sie Teil des Design-Systems ist (nur #000/#FFF, harte Kanten). Editierbar bleibt der
-- Text: die Bildunterschrift-Vorlage (mit Platzhaltern {brand}/{name}/{price}/{link}) und die
-- Hashtag-Sets je Welt, die auch der Content-Begleiter (Teil 16b) mitbenutzen kann.
INSERT INTO public.ai_config (key, value)
VALUES ('share_kit_texts', '{
  "caption_template": "{brand} — {name}\n{price} · Jetzt bei PAWN: {link}",
  "hashtag_sets": {
    "Mode": ["#pawnvision", "#unabhaengigesdesign", "#slowfashion", "#modedesign"],
    "Interior": ["#pawnvision", "#unabhaengigesdesign", "#interiordesign", "#wohnkultur"],
    "Kunst": ["#pawnvision", "#unabhaengigesdesign", "#zeitgenoessischekunst", "#kunstkauf"]
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
