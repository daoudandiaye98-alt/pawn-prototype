-- Teil 6c: Haus-Signaturen, Lernschleife (video_taste_weights), Editionen.

CREATE TABLE public.house_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipe jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_house_signatures_designer ON public.house_signatures(designer_id, created_at DESC);

ALTER TABLE public.house_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own signatures" ON public.house_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = house_signatures.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "admin manages signatures" ON public.house_signatures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lernschleife: je Haus destillierte "Was zieht"-Gewichte (analog ai_config.matching_weights,
-- aber pro Haus statt global) — geschrieben vom wöchentlichen Jarvis-Modus kampagnen_regie.
ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS video_taste_weights jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Editionen: häuserübergreifende Kampagnen aus dem Admin-Cockpit (oder von Jarvis als Entwurf vorgeschlagen).
CREATE TABLE public.editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL,
  world text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'done', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages editions" ON public.editions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "designer reads own editions" ON public.editions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.edition_participants ep
    JOIN public.designers d ON d.id = ep.designer_id
    WHERE ep.edition_id = editions.id AND d.user_id = auth.uid()
  ));

-- Pro Haus: Freigabe-Status einer Edition. Kein Video landet in video_assets, bevor der Designer
-- "Umsetzen" gewählt hat (analog dem jarvis_pending_actions-Muster, hier je Haus statt global).
CREATE TABLE public.edition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'approved', 'declined', 'failed')),
  video_url text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, designer_id)
);

CREATE INDEX idx_edition_participants_designer ON public.edition_participants(designer_id, status);

ALTER TABLE public.edition_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own participation" ON public.edition_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = edition_participants.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "designer updates own participation" ON public.edition_participants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = edition_participants.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = edition_participants.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "admin manages participation" ON public.edition_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 'regie' als neue Jarvis-Berichtsart (wöchentliche Lernschleife, kampagnen_regie-Modus).
ALTER TABLE public.jarvis_reports DROP CONSTRAINT IF EXISTS jarvis_reports_kind_check;
ALTER TABLE public.jarvis_reports ADD CONSTRAINT jarvis_reports_kind_check
  CHECK (kind IN ('morgen', 'woche', 'recherche', 'antwort', 'diagnose', 'dossier', 'regie'));
