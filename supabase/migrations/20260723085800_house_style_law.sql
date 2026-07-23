-- Teil 7a: Haus-Stilgesetz — gilt für jeden textschreibenden KI-Schritt
-- (pawn-chat, studio-ai, pawn-jarvis akquise_verfassen). Editierbar unter
-- /admin/ki → Denklogik. Edge Functions fallen ohne diese Zeile auf denselben
-- Text als Code-Default zurück, dies hier macht ihn nur sichtbar/editierbar.
INSERT INTO public.ai_config (key, value)
VALUES ('house_style_law', '{"text": "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel."}'::jsonb)
ON CONFLICT (key) DO NOTHING;
