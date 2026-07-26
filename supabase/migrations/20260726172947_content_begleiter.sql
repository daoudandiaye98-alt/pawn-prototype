-- Teil 16b: Content-Begleiter — knappe, praktische Leitfäden je Welt (Mode/Interior/Kunst,
-- gleichrangig), editierbar unter /admin/texte-bilder. Erweitert nur additiv die bestehende
-- unsichtbare Kosten-Wahrheit (ai_action_costs_cents) um den neuen Feedback-Schritt.
INSERT INTO public.site_content (key, value) VALUES
  ('content_guide.mode.text', '"Zeig die Hand, die näht — eine Nadel im Stoff, eine Naht im Entstehen, sagt mehr als das fertige Stück allein. Am Objekt selbst ist oft der Übergang interessant: wo ein Saum umschlägt, wie ein Verschluss sitzt, wie ein Stoff im Licht die Farbe wechselt. Nahaufnahmen lohnen sich mehr als Totalen — zeig Textur, nicht nur Form. Der Entstehungsweg erzählt sich am besten in Schritten: Skizze, Zuschnitt, erste Anprobe, fertiges Stück. Zeig dich selten, aber wenn, dann bei der Arbeit, nicht posierend."'::jsonb),
  ('content_guide.interior.text', '"Ein Möbelstück lebt vom Material und der Verbindung — eine Zinkung, eine Fuge, eine Maserung, die sich fortsetzt, zeigt Können besser als das fertige Stück in der Totale. Licht ist fast wichtiger als das Objekt selbst: seitliches Tageslicht zeigt Textur, Gegenlicht verschluckt sie. Perspektiven auf Augenhöhe und leicht von unten lassen ein Stück bedeutender wirken. Der Entstehungsweg lohnt sich in groben Schritten: Rohmaterial, Werkstatt, fast fertig. Zeig dich gelegentlich an der Werkbank, das schafft Vertrauen."'::jsonb),
  ('content_guide.kunst.text', '"Bei einem Werk ist oft der Farbauftrag selbst das Interessante — eine Nahaufnahme der Oberfläche zeigt, was ein Foto der ganzen Fläche verschluckt. Perspektiven, die den Bildraum zeigen, machen ein Werk räumlich statt flach. Der Entstehungsweg trägt eine eigene Geschichte: eine erste Skizze, ein Zwischenstand, das fertige Werk im Atelier-Licht. Größe wird erst im Kontext klar — ein Werk neben einer Hand, einer Tür, einem Möbelstück. Zeig dich selten, aber im Moment der Arbeit."'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE public.ai_config
SET value = value || '{"content_feedback": 3}'::jsonb
WHERE key = 'ai_action_costs_cents';

INSERT INTO public.ai_config (key, value)
VALUES ('ai_action_costs_cents', '{"content_feedback": 3}'::jsonb)
ON CONFLICT (key) DO NOTHING;
