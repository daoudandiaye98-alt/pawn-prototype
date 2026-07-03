
-- Fix search_path on slugify
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
           regexp_replace(lower(coalesce(txt,'')), '[^a-z0-9]+', '-', 'g'),
           '(^-+|-+$)', '', 'g'
         );
$$;

-- Lock down execute privileges: only authenticated users may invoke.
REVOKE ALL ON FUNCTION public.approve_designer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_designer(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.slugify(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_designer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_designer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slugify(text) TO authenticated;
