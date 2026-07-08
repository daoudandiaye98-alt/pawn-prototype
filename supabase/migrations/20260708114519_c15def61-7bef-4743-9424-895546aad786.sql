
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read contact_messages" ON public.contact_messages;
CREATE POLICY "admins read contact_messages" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins update contact_messages" ON public.contact_messages;
CREATE POLICY "admins update contact_messages" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
