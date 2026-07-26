-- Teil 16a: Inszenierungs-Vorlagen (staging_templates) — je erkannter Art (kleidung, keramik,
-- malerei, skulptur, moebel, schmuck, textil, objekt, sonstiges) eine Liste von Varianten mit
-- Kennung, Anzeigename, Beschreibung, Prompt-Vorlage, Beispielbild-URL (vom Admin unter
-- /admin/ki nachzupflegen, hier leer), Credit-Kosten. Jede Prompt-Vorlage verankert die feste
-- Regel: Form/Farbe/Material/Zustand des realen Stücks bleiben unverändert, nur Umgebung/Licht/
-- Blickwinkel ändern sich. Bei allem außer Kleidung trägt mindestens eine Variante
-- "groessenbezug": true — macht die reale Größe des Stücks erkennbar.
INSERT INTO public.ai_config (key, value)
VALUES ('staging_templates', '{
  "kleidung": [
    {"id": "am_model", "label": "Am Model", "description": "Fotorealistischer Mensch trägt das Stück, Ganzkörper.", "prompt": "Photorealistic full-body fashion photograph of a person wearing this exact garment, natural studio lighting, neutral background, editorial pose. Preserve the garment''s exact shape, colors, materials, patterns and condition — do not alter the product itself, only add a person wearing it and adjust environment, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true},
    {"id": "freisteller_weiss", "label": "Freisteller auf Weiß", "description": "Sauberer Produktausschnitt auf reinweißem Studiohintergrund.", "prompt": "Professional e-commerce product photograph of this exact garment on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow, centered composition, no props. Preserve the garment''s exact shape, colors, materials and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true},
    {"id": "flatlay", "label": "Flach gelegt (Flatlay)", "description": "Von oben fotografiert, flach ausgelegt.", "prompt": "Overhead flat-lay photograph of this exact garment neatly arranged on a clean neutral surface, soft natural light, styled minimally. Preserve the garment''s exact shape, colors, materials and condition — only change the camera angle, surface and lighting.", "preview_url": "", "credits": 2, "active": true},
    {"id": "detail_verarbeitung", "label": "Detail der Verarbeitung", "description": "Nahaufnahme von Naht, Stoff oder Knopf.", "prompt": "Extreme close-up macro photograph of the fabric texture, seams and craftsmanship details of this exact garment, soft directional light emphasizing texture. Preserve the exact materials, colors and construction — do not alter the product, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true}
  ],
  "keramik": [
    {"id": "seitenlicht", "label": "Auf heller Fläche, Seitenlicht", "description": "Natürliches Seitenlicht auf heller Fläche.", "prompt": "Product photograph of this exact object placed on a bright, minimal surface, soft natural side light casting gentle shadows, editorial styling, no props. Preserve the object''s exact shape, color, material and condition — only change the environment, lighting and camera angle.", "preview_url": "", "credits": 2, "active": true},
    {"id": "in_hand", "label": "In einer Hand gehalten", "description": "Für einen erkennbaren Größenbezug.", "prompt": "Photograph of a hand naturally holding this exact object, neutral background, soft daylight, so the viewer can judge its real size. Preserve the object''s exact shape, color, material and condition — do not alter the product, only add a hand for scale and adjust lighting.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "in_benutzung", "label": "In Benutzung", "description": "Z. B. Schale gefüllt oder Tasse mit Kaffee.", "prompt": "Lifestyle photograph of this exact object in natural everyday use (for example a bowl filled with food, or a cup holding coffee), soft natural light, warm and inviting setting. Preserve the object''s exact shape, color, material and condition — only change the surrounding context, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true},
    {"id": "freisteller_weiss", "label": "Freisteller auf Weiß", "description": "Sauberer Katalogausschnitt auf Weiß.", "prompt": "Professional e-commerce product photograph of this exact object on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow, centered composition. Preserve the object''s exact shape, color, material and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true}
  ],
  "malerei": [
    {"id": "an_wand", "label": "An schlichter Wand, im Raum", "description": "Hängend mit Raumkontext.", "prompt": "Photograph of this exact artwork hanging on a plain, minimal wall in a softly lit room, slightly wide framing to show context. Preserve the artwork''s exact composition, colors and surface — do not alter the piece itself, only change the surrounding room, lighting and camera angle.", "preview_url": "", "credits": 2, "active": true},
    {"id": "katalog_gerade", "label": "Gerade, randscharf (Katalog)", "description": "Frontal und randscharf abfotografiert.", "prompt": "Straight-on, edge-to-edge catalog photograph of this exact artwork, even diffused lighting, no glare, no frame distortion. Preserve the artwork''s exact composition, colors and surface exactly as is — only adjust lighting and camera angle for a clean, flat reproduction.", "preview_url": "", "credits": 1, "active": true},
    {"id": "detail_oberflaeche", "label": "Detail der Oberfläche", "description": "Nahaufnahme von Farbauftrag und Textur.", "prompt": "Close-up macro photograph of the surface texture and brushwork or material of this exact artwork, raking light to reveal texture. Preserve the artwork''s exact colors and surface — do not alter it, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true},
    {"id": "im_wohnraum", "label": "Im Wohnraum über einem Möbelstück", "description": "Für den Größenbezug.", "prompt": "Photograph of this exact artwork hanging in a furnished living room above a piece of furniture such as a sideboard or sofa, natural daylight, so the viewer can judge its real size in context. Preserve the artwork''s exact composition, colors and surface — only change the surrounding room, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true}
  ],
  "skulptur": [
    {"id": "auf_sockel", "label": "Auf Sockel, neutraler Grund", "description": "Klassische Sockel-Präsentation.", "prompt": "Photograph of this exact sculpture displayed on a simple pedestal against a neutral background, soft studio lighting emphasizing form and shadow. Preserve the sculpture''s exact shape, material, texture and color — do not alter it, only change the background, pedestal and lighting.", "preview_url": "", "credits": 2, "active": true},
    {"id": "im_raum_tageslicht", "label": "Im Raum mit Tageslicht", "description": "Für den Größenbezug.", "prompt": "Photograph of this exact sculpture placed in a softly lit interior room with natural daylight and visible surrounding furniture or architecture, so the viewer can judge its real size. Preserve the sculpture''s exact shape, material and color — only change the surrounding space, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "detailansicht", "label": "Detailansicht", "description": "Nahaufnahme von Form und Oberfläche.", "prompt": "Close-up photograph emphasizing the form, texture and material detail of this exact sculpture, dramatic soft lighting. Preserve the sculpture''s exact shape, material and color — do not alter it, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true}
  ],
  "moebel": [
    {"id": "im_wohnraum", "label": "Im eingerichteten Wohnraum", "description": "Für den Größenbezug.", "prompt": "Photograph of this exact piece of furniture placed naturally in a tastefully furnished living space, soft natural daylight, so the viewer can judge its real size and how it fits a room. Preserve the furniture''s exact shape, material, color and condition — do not alter it, only change the surrounding room, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "freisteller_weiss", "label": "Freigestellt vor Weiß", "description": "Sauberer Katalogausschnitt.", "prompt": "Professional e-commerce product photograph of this exact piece of furniture on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow. Preserve the furniture''s exact shape, material, color and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true},
    {"id": "detail_material", "label": "Detail von Material und Verbindung", "description": "Nahaufnahme von Holzmaserung, Naht oder Verbindung.", "prompt": "Close-up macro photograph of the material, grain and joinery details of this exact piece of furniture, soft directional light. Preserve the exact materials, colors and construction — do not alter the product, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true}
  ],
  "schmuck": [
    {"id": "makro", "label": "Makroaufnahme, schlichter Grund", "description": "Nahaufnahme auf neutralem Untergrund.", "prompt": "Macro product photograph of this exact piece of jewelry on a simple, neutral surface, soft studio lighting emphasizing detail and shine. Preserve the jewelry''s exact shape, material, color and condition — do not alter it, only change the background and lighting.", "preview_url": "", "credits": 2, "active": true},
    {"id": "am_koerper", "label": "Am Körper getragen", "description": "Für den Größenbezug.", "prompt": "Photorealistic photograph of this exact piece of jewelry worn naturally on a person''s hand, wrist, ear or neck, whichever fits, soft natural light, so the viewer can judge its real size. Preserve the jewelry''s exact shape, material, color and condition — do not alter it, only add a person wearing it and adjust lighting.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "freisteller_weiss", "label": "Freisteller auf Weiß", "description": "Sauberer Katalogausschnitt.", "prompt": "Professional e-commerce product photograph of this exact piece of jewelry on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow. Preserve the jewelry''s exact shape, material, color and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true}
  ],
  "textil": [
    {"id": "drapiert", "label": "Drapiert mit Fall und Faltenwurf", "description": "Zeigt, wie der Stoff fällt.", "prompt": "Photograph of this exact textile piece draped naturally to show its drape and folds, soft studio lighting, neutral background. Preserve the textile''s exact color, pattern, material and condition — do not alter it, only change the draping, lighting and camera angle.", "preview_url": "", "credits": 2, "active": true},
    {"id": "detail_struktur", "label": "Detail der Struktur", "description": "Nahaufnahme von Webart oder Muster.", "prompt": "Close-up macro photograph of the weave, texture and pattern of this exact textile piece, soft directional light. Preserve the exact materials, colors and pattern — do not alter it, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true},
    {"id": "in_verwendung", "label": "In Verwendung", "description": "Für den Größenbezug.", "prompt": "Lifestyle photograph of this exact textile piece in natural everyday use, for example as a throw on a sofa or a runner on a table, soft natural light, so the viewer can judge its real size and how it is used. Preserve the textile''s exact color, pattern, material and condition — only change the surrounding context, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true}
  ],
  "objekt": [
    {"id": "seitenlicht", "label": "Auf heller Fläche, Seitenlicht", "description": "Natürliches Seitenlicht auf heller Fläche.", "prompt": "Product photograph of this exact object placed on a bright, minimal surface, soft natural side light casting gentle shadows, editorial styling, no props. Preserve the object''s exact shape, color, material and condition — only change the environment, lighting and camera angle.", "preview_url": "", "credits": 2, "active": true},
    {"id": "in_hand", "label": "In einer Hand gehalten", "description": "Für einen erkennbaren Größenbezug.", "prompt": "Photograph of a hand naturally holding this exact object, neutral background, soft daylight, so the viewer can judge its real size. Preserve the object''s exact shape, color, material and condition — do not alter the product, only add a hand for scale and adjust lighting.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "in_benutzung", "label": "In Benutzung", "description": "In einem passenden, alltäglichen Zusammenhang.", "prompt": "Lifestyle photograph of this exact object in natural everyday use, soft natural light, warm and inviting setting. Preserve the object''s exact shape, color, material and condition — only change the surrounding context, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true},
    {"id": "freisteller_weiss", "label": "Freisteller auf Weiß", "description": "Sauberer Katalogausschnitt auf Weiß.", "prompt": "Professional e-commerce product photograph of this exact object on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow, centered composition. Preserve the object''s exact shape, color, material and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true}
  ],
  "sonstiges": [
    {"id": "freisteller_weiss", "label": "Freisteller auf Weiß", "description": "Sauberer Katalogausschnitt auf Weiß.", "prompt": "Professional e-commerce product photograph of this exact object on a pure white seamless studio background, soft even diffused lighting, subtle contact shadow, centered composition. Preserve the object''s exact shape, color, material and details — only replace the background and lighting.", "preview_url": "", "credits": 1, "active": true},
    {"id": "im_kontext", "label": "Im passenden Umfeld", "description": "Zeigt das Stück in einer natürlichen Umgebung, mit Größenbezug.", "prompt": "Photograph of this exact object placed naturally in a fitting real-world setting with recognizable surrounding context for scale, soft natural light. Preserve the object''s exact shape, color, material and condition — do not alter it, only change the environment, lighting and camera angle.", "preview_url": "", "credits": 3, "active": true, "groessenbezug": true},
    {"id": "detailansicht", "label": "Detailansicht", "description": "Nahaufnahme von Form und Material.", "prompt": "Close-up photograph emphasizing the form, texture and material detail of this exact object, soft directional light. Preserve the object''s exact shape, material and color — do not alter it, only change framing and lighting.", "preview_url": "", "credits": 2, "active": true}
  ]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Erweitert die bestehende, unsichtbare Kosten-Wahrheit (Cent) um die Objekterkennung und den
-- Inszenierungs-Lauf — nur additiv, kein bestehender Schlüssel wird überschrieben.
UPDATE public.ai_config
SET value = value || '{"staging_detect": 3, "staging_shot": 6}'::jsonb
WHERE key = 'ai_action_costs_cents';

INSERT INTO public.ai_config (key, value)
VALUES ('ai_action_costs_cents', '{"staging_detect": 3, "staging_shot": 6}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Ein Inszenierungs-Lauf erzeugt mehrere Varianten aus einem Ausgangsfoto (Teil 16a). Eigene
-- Tabelle statt Erweiterung von product_shot_requests, weil ein Lauf mehrere Zeilen erzeugt
-- (eine je Variante) statt einem 1:1-Vorher/Nachher — run_id gruppiert die Varianten desselben
-- Laufs. product_id bleibt optional, damit auch ein noch nicht verknüpftes Kampagnen-Foto
-- inszeniert werden kann.
CREATE TABLE public.staging_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  art text NOT NULL,
  template_id text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  result_url text,
  request_handle jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staging_requests TO authenticated;
GRANT ALL ON public.staging_requests TO service_role;

ALTER TABLE public.staging_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer_own_staging_select" ON public.staging_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE POLICY "designer_own_staging_insert" ON public.staging_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE POLICY "designer_own_staging_update" ON public.staging_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE TRIGGER set_staging_requests_updated_at
BEFORE UPDATE ON public.staging_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Beispielbilder für die Inszenierungs-Vorlagen (Admin lädt sie unter /admin/ki hoch, s.
-- StagingTemplatesEditor). Gleiches Muster wie model-pool: privater Bucket, nur Admin lädt
-- hoch, angezeigt wird über eine 5 Jahre gültige signierte URL, die in ai_config.staging_templates
-- gespeichert wird — kein zusätzlicher Lese-Zugriff für andere Rollen nötig.
INSERT INTO storage.buckets (id, name, public)
VALUES ('staging-previews', 'staging-previews', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "staging_previews_admin_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'staging-previews' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "staging_previews_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'staging-previews' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "staging_previews_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'staging-previews') WITH CHECK (bucket_id = 'staging-previews');
