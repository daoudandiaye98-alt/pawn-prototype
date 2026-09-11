REVOKE ALL ON FUNCTION public.ist_kauf_freigeschaltet(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ist_kauf_freigeschaltet(uuid) TO authenticated, anon, service_role;