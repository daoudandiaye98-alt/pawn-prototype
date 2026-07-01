
-- =========================================================================
-- ROLES
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('customer', 'designer', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en-US',
  consent_personalization BOOLEAN NOT NULL DEFAULT true,
  consent_memory BOOLEAN NOT NULL DEFAULT true,
  consent_analytics BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile self read"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profile self insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profile self update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-provision profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- DOMAIN EVENTS (append-only source of truth)
-- =========================================================================
CREATE TABLE public.domain_events (
  id TEXT PRIMARY KEY,                       -- client-generated deterministic id
  at TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,                       -- 'system' or a user id string
  type TEXT NOT NULL,
  cause TEXT REFERENCES public.domain_events(id),
  payload JSONB NOT NULL,
  identity_scope UUID,                       -- user id if this is user-owned
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX domain_events_scope_at_idx ON public.domain_events (identity_scope, at);
CREATE INDEX domain_events_type_at_idx ON public.domain_events (type, at);
CREATE INDEX domain_events_cause_idx ON public.domain_events (cause);

GRANT SELECT, INSERT ON public.domain_events TO authenticated;
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identity reads own events"
  ON public.domain_events FOR SELECT TO authenticated
  USING (identity_scope = auth.uid());
CREATE POLICY "admins read all events"
  ON public.domain_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "identity appends own events"
  ON public.domain_events FOR INSERT TO authenticated
  WITH CHECK (
    identity_scope = auth.uid()
    AND (actor = auth.uid()::text OR actor = 'system')
  );

-- =========================================================================
-- DOMAIN SNAPSHOTS (per-identity fast reload)
-- =========================================================================
CREATE TABLE public.domain_snapshots (
  identity_scope UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  last_event_id TEXT REFERENCES public.domain_events(id),
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.domain_snapshots TO authenticated;
GRANT ALL ON public.domain_snapshots TO service_role;
ALTER TABLE public.domain_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshot self read"
  ON public.domain_snapshots FOR SELECT TO authenticated
  USING (identity_scope = auth.uid());
CREATE POLICY "snapshot self write"
  ON public.domain_snapshots FOR INSERT TO authenticated
  WITH CHECK (identity_scope = auth.uid());
CREATE POLICY "snapshot self update"
  ON public.domain_snapshots FOR UPDATE TO authenticated
  USING (identity_scope = auth.uid()) WITH CHECK (identity_scope = auth.uid());
CREATE POLICY "admins read all snapshots"
  ON public.domain_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER snapshots_updated
  BEFORE UPDATE ON public.domain_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- AI LOGS (governance + observability)
-- =========================================================================
CREATE TABLE public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_scope UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  prompt_version_id TEXT,
  model TEXT,
  request JSONB NOT NULL,
  response JSONB,
  latency_ms INT,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  cause_event_id TEXT REFERENCES public.domain_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_logs_scope_created_idx ON public.ai_logs (identity_scope, created_at DESC);
CREATE INDEX ai_logs_agent_created_idx ON public.ai_logs (agent_id, created_at DESC);

GRANT SELECT ON public.ai_logs TO authenticated;
GRANT ALL ON public.ai_logs TO service_role;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai log self read"
  ON public.ai_logs FOR SELECT TO authenticated
  USING (identity_scope = auth.uid());
CREATE POLICY "ai log admin read"
  ON public.ai_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
