-- Teil O / 7 — `anon` durfte alle 60 Spalten von `designers` lesen.
--
-- Darunter acht Stripe-Spalten (Konto-Kennung, Auszahlungsstatus, Kunden- und
-- Abo-Kennung, offene Anforderungen), die Verknüpfung `user_id` zum Konto und
-- `revenue_share_pct` — die kaufmännische Vereinbarung je Haus. Jede und jeder
-- mit dem öffentlichen Schlüssel aus dem Browser-Bündel konnte sie abfragen.
--
-- PostgreSQL kennt nur ganz oder spaltenweise: ein Tabellen-GRANT gilt für alle
-- Spalten. Deshalb wird er entzogen und spaltenweise neu vergeben — alles ausser
-- den 21 heiklen. Das Heft braucht 28 Spalten und behält sie vollständig.
--
-- Die Sichten `heft_haeuser` und `heft_produkte` sind `security_invoker = true`
-- und führen keine dieser Spalten — der Entzug greift also auch durch sie.

do $do$
declare
  heikel text[] := array[
    'stripe_account_id','stripe_charges_enabled','stripe_details_submitted','stripe_payouts_enabled',
    'stripe_requirements','stripe_country','stripe_subscription_id','stripe_customer_id',
    'user_id','revenue_share_pct','application_id','aussenauge',
    'dismissed_suggestions','onboarding_state','studio_last_seen_at','hausseite_cover_shown_at',
    'weekly_impulse','weekly_impulse_at','media_rights_granted_at','plan_seit','plan_bis'
  ];
  liste text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into liste
    from information_schema.columns
   where table_schema = 'public' and table_name = 'designers'
     and not (column_name = any(heikel));

  execute 'revoke select on public.designers from anon';
  execute format('grant select (%s) on public.designers to anon', liste);
end $do$;

-- Belegt: Gäste lesen 39 von 60 Spalten; die 28 Spalten des Hefts sind vollständig dabei.

