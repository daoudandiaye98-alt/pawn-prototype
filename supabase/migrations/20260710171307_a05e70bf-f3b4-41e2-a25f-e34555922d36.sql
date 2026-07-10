
-- product_shot_requests
CREATE TABLE IF NOT EXISTS public.product_shot_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  result_url text,
  status text NOT NULL DEFAULT 'requested',
  provider text,
  request_handle jsonb,
  error text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_shot_requests TO authenticated;
GRANT ALL ON public.product_shot_requests TO service_role;

ALTER TABLE public.product_shot_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer_own_shots_select" ON public.product_shot_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE POLICY "designer_own_shots_insert" ON public.product_shot_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE POLICY "designer_own_shots_update" ON public.product_shot_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid())
);

CREATE TRIGGER set_product_shot_requests_updated_at
BEFORE UPDATE ON public.product_shot_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for product-shots bucket
CREATE POLICY "product_shots_owner_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-shots' AND (
    public.has_role(auth.uid(),'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "product_shots_owner_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-shots' AND (
    public.has_role(auth.uid(),'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "product_shots_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'product-shots') WITH CHECK (bucket_id = 'product-shots');

-- Seed default video provider config (only insert if missing)
INSERT INTO public.ai_config(key, value)
VALUES ('video_provider', jsonb_build_object(
  'model', 'fal-ai/wan/v2.2-a14b/image-to-video/lora',
  'note', 'Standard: kostengünstig. Premium-Alternative: fal-ai/kling-video/v2.1/standard/image-to-video'
))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ai_config(key, value)
VALUES ('image_edit_provider', jsonb_build_object(
  'model', 'fal-ai/nano-banana/edit',
  'note', 'Gemini Flash Image Edit via fal.ai.'
))
ON CONFLICT (key) DO NOTHING;
