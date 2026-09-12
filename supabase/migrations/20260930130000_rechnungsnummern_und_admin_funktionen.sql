-- M7, zweiter Durchgang: sechs SECURITY-DEFINER-Funktionen, die jeder rufen kann.
--
-- WARUM ES EINEN ZWEITEN DURCHGANG BRAUCHT: 20260930090000 wurde gegen eine Datenbank
-- geschrieben, auf der erst 35 Migrationen lagen. Sie konnte nur sehen, was damals da
-- war. Nach dem vollstaendigen Abspielen der Kette (168 Versionen, 12.09.2026) waren es
-- wieder 15 SECURITY-DEFINER-Funktionen, die `anon` aufrufen darf. Die fuenf aus dem
-- ersten Durchgang sind zu und geblieben — diese sechs kamen mit dem Rest der Kette.
--
-- DER ERNSTE FALL, und er ist kein Schoenheitsfehler:
--   assign_invoice_number(uuid, uuid)  SCHREIBT. Sie zaehlt
--   designer_billing_profiles.invoice_next_number hoch und stempelt die Nummer auf eine
--   Bestellung. Ihre eigene Datei (20260811002120) vergibt EXECUTE ausdruecklich nur an
--   service_role — aber ohne ein REVOKE behaelt PUBLIC das Vorgabe-Recht, und `anon`
--   erbt es. Wer den oeffentlichen Schluessel hat, konnte damit Rechnungsnummern
--   verbrennen. Ein Rechnungsnummernkreis muss lueckenlos sein (§14 UStG); Luecken
--   darin sind ein Buchhaltungsproblem, keine Unbequemlichkeit. Gemessen am
--   12.09.2026: has_function_privilege('anon', ..., 'EXECUTE') = true.
--   next_invoice_number(uuid) hat dasselbe Loch und ruft im ganzen Repo niemand.
--
-- Die vier uebrigen pruefen has_role im Rumpf und brechen fuer `anon` sowieso ab — sie
-- werden trotzdem zugezogen, weil eine Funktion, die nur ihr eigener Rumpf schuetzt,
-- eine Tuer ist, die nur von innen zugehalten wird.

-- ── Nur die Edge Functions, mit dem Service-Schluessel. ────────────────────────
revoke execute on function public.assign_invoice_number(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.next_invoice_number(uuid)         from public, anon, authenticated;

-- ── Das Admin-Cockpit, als angemeldeter Mensch. ───────────────────────────────
revoke execute on function public.match_inbound_email(uuid, uuid)      from public, anon;
revoke execute on function public.resolve_inbound_reply(uuid, text)    from public, anon;
revoke execute on function public.backfill_lead_attribution()          from public, anon;
revoke execute on function public.get_attribution_stats()              from public, anon;
grant  execute on function public.match_inbound_email(uuid, uuid)      to authenticated;
grant  execute on function public.resolve_inbound_reply(uuid, text)    to authenticated;
grant  execute on function public.backfill_lead_attribution()          to authenticated;
grant  execute on function public.get_attribution_stats()              to authenticated;

-- ── WAS HIER BEWUSST OFFEN BLEIBT, jedes mit Grund. ───────────────────────────
--
-- bump_product_view, bump_media_metric, bump_video_metric
--   Absicht. Ihre Dateien vergeben EXECUTE ausdruecklich an anon: ein Besucher zaehlt
--   einen Aufruf, ohne angemeldet zu sein. Sie schreiben nur einen Zaehler hoch und
--   nehmen keine Kennung von aussen ausser der des Stuecks.
--
-- get_lead_invitation, count_founding_designers, get_founding_social_proof
--   Absicht. Die Einladungsseite /einladung/<code> wird von Menschen geoeffnet, die
--   noch kein Konto haben. Sie geben eng zugeschnittene, oeffentlich unkritische
--   Felder heraus — das ist der ganze Zweck der Funktionen.
--
-- order_has_my_house_items
--   NICHT ANFASSEN. Sie steht in der RLS-Policy "designer sees orders containing own
--   products" auf public.orders (20260801100648, Zeile 21). Ein Entzug fuer
--   `authenticated` wuerde jedes Haus aus seinen EIGENEN Bestellungen sperren —
--   dieselbe Falle wie bei has_role. Als `anon` ist auth.uid() leer, die Funktion
--   gibt false zurueck und verraet nichts.
--
-- ist_verkaufsbereit, ist_kauf_freigeschaltet
--   Lesen nur einen Wahrheitswert je Haus ("kann dieses Haus verkaufen"), und genau
--   dieser Wert steht ohnehin oeffentlich in designers.kauf_freigeschaltet, das die
--   Heft-Sicht ausliefert. Sie zuzuziehen braeuchte einen Beleg, dass sie im Frontend
--   nirgends fuer Besucher gerufen werden — den habe ich nicht, und eine Vermutung
--   rechtfertigt kein Risiko auf einer Seite, die Kaufknoepfe anzeigt.
