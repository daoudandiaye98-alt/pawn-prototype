
CREATE POLICY "model_pool_admin_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'model-pool' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "model_pool_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'model-pool' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "model_pool_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'model-pool') WITH CHECK (bucket_id = 'model-pool');
