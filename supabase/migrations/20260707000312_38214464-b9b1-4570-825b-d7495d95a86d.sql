
-- Storage policies for site-assets: public read, admin write
DROP POLICY IF EXISTS "site-assets public read" ON storage.objects;
CREATE POLICY "site-assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "site-assets admin write" ON storage.objects;
CREATE POLICY "site-assets admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "site-assets admin update" ON storage.objects;
CREATE POLICY "site-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "site-assets admin delete" ON storage.objects;
CREATE POLICY "site-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));
