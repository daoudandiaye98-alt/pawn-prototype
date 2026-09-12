-- M7 — wer darf SECURITY-DEFINER-Funktionen rufen?
--
-- BEFUND, an cnxtdcifkrdxvajaikxq gemessen am 11.09.2026: 16 SECURITY-DEFINER-
-- Funktionen waren fuer `anon` ausfuehrbar. Der schwerste Fall ist
-- `zugang_zuweisen(uuid, text)`: sie liest `zugang_bootstrap` (RLS ohne Policy haelt
-- sie als DEFINER nicht auf) und schreibt `user_roles`. Wer den oeffentlichen
-- anon-Schluessel hat und eine E-Mail aus der Bootstrap-Tabelle kennt — sie steht im
-- Repo —, konnte sich damit selbst `admin` geben. Das ist keine theoretische Luecke,
-- das ist eine Kontouebernahme mit oeffentlichen Mitteln.
--
-- WARUM `FROM PUBLIC` UND NICHT `FROM anon`: PostgreSQL vergibt EXECUTE auf neue
-- Funktionen per Vorgabe an PUBLIC. In pg_proc.proacl steht deshalb `=X/postgres`,
-- und `anon` haelt das Recht NICHT direkt, sondern geerbt. Ein `REVOKE ... FROM anon`
-- waere an genau diesen Funktionen wirkungslos gewesen — gemessen, nicht vermutet.
--
-- WAS HIER BEWUSST NICHT PASSIERT, und beides ist wichtiger als Vollstaendigkeit:
--
--   1. `has_role` und `designer_level` werden NICHT angefasst. `has_role` steht in
--      den RLS-Policies selbst (13 Fundstellen im Code, dazu jede Policy). Ein
--      Entzug fuer `authenticated` wuerde jeden Nutzer aus seinen EIGENEN Zeilen
--      sperren. Das Loch waere zu und die Seite tot. Beide haben ohnehin kein
--      PUBLIC-Recht, sondern ein ausdrueckliches `authenticated=X`.
--
--   2. Die NEUN Trigger-Funktionen werden NICHT angefasst (enqueue_campaign_post,
--      on_application_decided, on_application_submitted, on_campaign_status_change,
--      on_message_created, protect_designer_admin_columns, sync_tags_from_product_dna,
--      trg_recompute_brand_dna, zugang_bei_anmeldung). Sie geben `trigger` zurueck;
--      PostgREST stellt solche Funktionen gar nicht bereit, von aussen ruft sie also
--      niemand — die Angriffsflaeche ist null. Sie hier mitzunehmen waere Hygiene mit
--      einem Restrisiko fuer die Anmeldung und fuer das Speichern von Werken, auf
--      einer Datenbank, die echte Zahlungen traegt. Wer es dennoch will, macht es als
--      eigene Migration, mit einer Anmeldung als Probe danach.

-- ── Niemand im Netz ruft diese, auch kein angemeldeter Mensch. ──────────────────
-- Die Trigger rufen sie im DEFINER-Zusammenhang; dafuer braucht die aufrufende
-- Rolle kein EXECUTE. `merge_anon_session` ruft niemand: die einzigen Fundstellen im
-- Code sind Kommentare, die erklaeren, warum sie nicht taugt (Teil L11).
revoke execute on function public.zugang_zuweisen(uuid, text)            from public, anon, authenticated;
revoke execute on function public.merge_anon_session(text, uuid)         from public, anon, authenticated;
revoke execute on function public.recompute_brand_dna(uuid)              from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text)  from public, anon, authenticated;
revoke execute on function public.resequence_posting_queue_day(date)     from public, anon, authenticated;

-- ── Das Cockpit ruft diese, als angemeldeter Admin. ────────────────────────────
-- Beide pruefen die Rolle selbst (has_role im Rumpf), Fundstelle
-- src/pages/admin/AdminApplications.tsx:302 und :312. `anon` braucht sie nie.
revoke execute on function public.add_application_note(uuid, text)       from public, anon;
revoke execute on function public.mark_application_in_review(uuid)       from public, anon;
grant  execute on function public.add_application_note(uuid, text)       to authenticated;
grant  execute on function public.mark_application_in_review(uuid)       to authenticated;

-- service_role behaelt ueberall EXECUTE — die Edge Functions arbeiten darueber.
