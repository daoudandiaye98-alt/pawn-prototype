-- Teil 12c: Das Haus als Doppelseite im Magazin. Der Designer gestaltet seine öffentliche
-- Hausseite selbst aus Bausteinen; jeder Baustein zieht sein Material aus der Mediathek
-- (media_assets, Teil 12b). Struktur je Haus, Vorschau vor dem Veröffentlichen: solange
-- designers.page_published_at leer ist, sieht nur das Haus selbst seinen Entwurf — die
-- öffentliche Seite zeigt bis dahin unverändert das bisherige Layout.

CREATE TYPE public.page_block_kind AS ENUM (
  'auftakt', 'editorial_text', 'zitat', 'produktreihe', 'lookbook_streifen', 'banner_seitlich', 'banner_vollbreite'
);

CREATE TABLE public.designer_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  kind public.page_block_kind NOT NULL,
  position int NOT NULL DEFAULT 0,
  -- Inhalt je nach Baustein, z. B.:
  --   auftakt/banner_*: {"media_asset_id": "...", "media_kind": "bild"|"video"}
  --   editorial_text: {"heading": "...", "text": "..."}
  --   zitat: {"quote": "...", "author": "..."}
  --   produktreihe: {"product_ids": ["..."]}
  --   lookbook_streifen: {"media_asset_ids": ["..."]}
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX designer_page_blocks_designer_position_idx ON public.designer_page_blocks (designer_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.designer_page_blocks TO authenticated;
GRANT SELECT ON public.designer_page_blocks TO anon;
GRANT ALL ON public.designer_page_blocks TO service_role;
ALTER TABLE public.designer_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer manages own page blocks" ON public.designer_page_blocks FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_page_blocks.designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_page_blocks.designer_id AND d.user_id = auth.uid())
  );

-- Öffentlich sichtbar nur für Häuser, die ihre Bausteinseite bereits veröffentlicht haben —
-- ohne Veröffentlichung bleibt der Entwurf privat, auch wenn Zeilen schon existieren.
CREATE POLICY "public reads blocks of published pages" ON public.designer_page_blocks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_page_blocks.designer_id AND d.page_published_at IS NOT NULL)
  );

ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS page_published_at timestamptz;

-- Seitlicher Banner je Produkt, aus der Mediathek gewählt (Teil 12c, Punkt 2).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS banner_media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;
