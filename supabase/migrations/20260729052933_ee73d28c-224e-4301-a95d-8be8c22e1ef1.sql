-- Datei 1: 20260726141711_staging_templates.sql
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

UPDATE public.ai_config
SET value = value || '{"staging_detect": 3, "staging_shot": 6}'::jsonb
WHERE key = 'ai_action_costs_cents';

INSERT INTO public.ai_config (key, value)
VALUES ('ai_action_costs_cents', '{"staging_detect": 3, "staging_shot": 6}'::jsonb)
ON CONFLICT (key) DO NOTHING;

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

CREATE POLICY "staging_previews_admin_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'staging-previews' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "staging_previews_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'staging-previews' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "staging_previews_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'staging-previews') WITH CHECK (bucket_id = 'staging-previews');

-- Datei 2: 20260726172947_content_begleiter.sql
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

-- Datei 3: 20260731090000_house_themes.sql
create table public.house_themes (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  version int not null default 1,
  is_current boolean not null default true,
  name text,
  input_prompt text,
  farbwelt jsonb not null default '{"bg":"#FFFFFF","fg":"#000000","accent":"#000000","muted":"#F2F2F2"}'::jsonb,
  typografie text not null default 'editorial',
  flaechenrhythmus text not null default 'ruhig',
  kantenhaerte text not null default 'hart',
  bewegungscharakter text not null default 'ruhig',
  hintergrundtextur jsonb not null default '{"typ":"keine"}'::jsonb,
  uebergangsart text not null default 'fade',
  zuversicht text not null default 'mittel',
  quelle text not null default 'manuell_verfeinert',
  guardrail_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.house_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_themes TO authenticated;
GRANT ALL ON public.house_themes TO service_role;

create unique index house_themes_one_current_per_designer on public.house_themes (designer_id) where is_current;
create index house_themes_designer_version_idx on public.house_themes (designer_id, version desc);

alter table public.house_themes enable row level security;

create policy "designer manages own house_themes" on public.house_themes
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.user_id = auth.uid()
  ))
  with check (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.user_id = auth.uid()
  ));

create policy "public reads current theme of published pages" on public.house_themes
  for select
  using (is_current and exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.page_published_at is not null
  ));

create trigger trg_house_themes_updated before update on public.house_themes
  for each row execute function set_updated_at();