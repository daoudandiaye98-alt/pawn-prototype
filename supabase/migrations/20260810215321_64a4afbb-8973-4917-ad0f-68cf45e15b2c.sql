ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS plate_images jsonb,
  ADD COLUMN IF NOT EXISTS plate_status text,
  ADD COLUMN IF NOT EXISTS plate_number integer;

CREATE INDEX IF NOT EXISTS acquisition_leads_plate_status_idx ON public.acquisition_leads (plate_status);

DROP FUNCTION IF EXISTS public.get_lead_invitation(text);
CREATE FUNCTION public.get_lead_invitation(_ref_code text)
RETURNS TABLE(handle text, world text, personal_line text, lead_type text, language text, plate_images jsonb, plate_number integer, plate_status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT handle, world, personal_line, lead_type, language, plate_images, plate_number, plate_status
  FROM public.acquisition_leads
  WHERE ref_code = upper(trim(_ref_code))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_invitation(text) TO anon, authenticated, service_role;