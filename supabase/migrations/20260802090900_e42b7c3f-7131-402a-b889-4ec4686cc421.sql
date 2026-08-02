CREATE TABLE public.customer_measurements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm numeric,
  shoulder_cm numeric,
  chest_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  inseam_cm numeric,
  foot_cm numeric,
  fit_preference text NOT NULL DEFAULT 'gerade',
  room_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_measurements TO authenticated;
GRANT ALL ON public.customer_measurements TO service_role;

ALTER TABLE public.customer_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own measurements only"
ON public.customer_measurements FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER customer_measurements_touch
BEFORE UPDATE ON public.customer_measurements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();