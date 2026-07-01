
-- Slice 1: Role-based event allow-list for domain_events.
-- Prevents customers from writing designer/admin events (e.g. designer.approved).

CREATE OR REPLACE FUNCTION public.enforce_event_role_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin_types text[] := ARRAY[
    'designer.approved','designer.rejected',
    'ai.prompt_updated','ai.agent_configured','ai.tool_enabled','ai.tool_disabled',
    'policy.updated','plugin.registered','plugin.enabled','plugin.disabled',
    'broadcast.sent','mutation.ratified','audit.written'
  ];
  designer_types text[] := ARRAY[
    'product.registered','collection.registered','product.drafted','product.published','product.updated'
  ];
BEGIN
  -- system-actor rows may only be written by admins (or service_role, which bypasses RLS)
  IF NEW.actor = 'system' AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: system actor requires admin' USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(admin_types) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'event_role_denied: % requires admin', NEW.type USING ERRCODE = '42501';
  END IF;
  IF NEW.type = ANY(designer_types) AND NOT (public.has_role(uid, 'designer') OR public.has_role(uid, 'admin')) THEN
    RAISE EXCEPTION 'event_role_denied: % requires designer', NEW.type USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_role_allowlist ON public.domain_events;
CREATE TRIGGER trg_enforce_event_role_allowlist
BEFORE INSERT ON public.domain_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_role_allowlist();
