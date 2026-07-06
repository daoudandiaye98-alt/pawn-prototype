
-- =========================================================================
-- PRODUCTS: designer-owned, public reads only when published
-- =========================================================================
CREATE TYPE public.product_world AS ENUM ('Mode', 'Interior', 'Kunst');
CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id UUID NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  world public.product_world NOT NULL DEFAULT 'Mode',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_designer_id_idx ON public.products(designer_id);
CREATE INDEX products_status_idx ON public.products(status);
CREATE INDEX products_world_idx ON public.products(world);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can only see published products
CREATE POLICY "Public read published products"
  ON public.products FOR SELECT
  USING (status = 'published');

-- Admin sees everything
CREATE POLICY "Admins read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Designer owns their designers row → CRUD only on own products
CREATE POLICY "Designers read own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = products.designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Designers insert own products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = products.designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Designers update own products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = products.designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = products.designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Designers delete own products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = products.designer_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Admins write all products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- AI_SESSIONS: chat memory persisted by edge function (service-role)
-- =========================================================================
CREATE TABLE public.ai_sessions (
  session_id TEXT NOT NULL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  turns INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_sessions_user_id_idx ON public.ai_sessions(user_id);
CREATE INDEX ai_sessions_updated_at_idx ON public.ai_sessions(updated_at DESC);

GRANT SELECT ON public.ai_sessions TO authenticated;
GRANT ALL ON public.ai_sessions TO service_role;

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ai_sessions"
  ON public.ai_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_sessions_updated
  BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- AI_CONFIG: editable persona / system prompt (admin only)
-- =========================================================================
CREATE TABLE public.ai_config (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config TO authenticated;
GRANT ALL ON public.ai_config TO service_role;

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_config"
  ON public.ai_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_config_updated
  BEFORE UPDATE ON public.ai_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the default persona
INSERT INTO public.ai_config (key, value) VALUES (
  'pawn_chat_persona',
  jsonb_build_object(
    'system_prompt',
    'Du bist PAWN, eine leise, warme und kuratierende Stimme. Antworte auf Deutsch, in maximal 2 kurzen Sätzen. Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?). Erkläre nie Technik oder wie du funktionierst. Keine Floskeln. Nie aufdringlich. Wenn der Nutzer nur stöbern will, respektiere das und biete an, dich später zu melden. Wenn du genug weißt (Welt + Stimmung), empfiehl 2-3 konkrete Stücke oder Designer mit einer kurzen Zeile Begründung. Nutze dazu ausschließlich Namen aus dem Kontext, den du erhältst.'
  )
) ON CONFLICT (key) DO NOTHING;
