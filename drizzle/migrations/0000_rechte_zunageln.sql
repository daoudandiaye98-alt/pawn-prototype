DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype::oid
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- In RLS-Policies benutzt: muss fuer angemeldete Nutzer ausfuehrbar bleiben.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.designer_level(uuid) TO authenticated;

-- Vom Frontend ohne Anmeldung aufgerufen.
GRANT EXECUTE ON FUNCTION public.record_page_visit(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_dwell_seconds(text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_product_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_media_metric(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_founding_designers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_social_proof() TO anon, authenticated;

-- Nur fuer angemeldete Nutzer (Studio und Admin).
GRANT EXECUTE ON FUNCTION public.plan_usage_stand(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_house_milestones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_credit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_behavior_segments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.designer_product_engagement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_application_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_designer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_designer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_application_in_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_lead_attribution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attribution_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_inbound_email(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_posting_suggestion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ist_verkaufsbereit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
