-- M3, erster Teil: die Tabellenrechte, die der Rueckweg mitgenommen hat.
--
-- WAS PASSIERT IST, und es war mein Fehler, nicht der der Kette:
-- Der Rueckweg des Erstaufbaus macht `drop schema public cascade; create schema public;`.
-- Ein NEUES Schema traegt keine Vorgabe-Rechte. Supabase hatte am alten Schema
--     alter default privileges in schema public grant all on tables to anon, authenticated, service_role
-- haengen — deshalb schreiben die meisten Migrationen gar keine GRANTs: sie brauchten
-- keine. Nach dem Rueckweg sind diese Vorgaben weg (gemessen am 12.09.2026: pg_default_acl
-- hat Eintraege fuer storage, auth, graphql, realtime, cron, extensions — fuer public
-- KEINEN). Jede Tabelle, deren Migration kein ausdrueckliches GRANT schreibt, steht damit
-- ohne Rechte da.
--
-- WAS DAS HEISST, gemessen: von 80 Tabellen durfte `authenticated` nur 63 lesen und
-- `service_role` ebenfalls nur 63. Die Edge Functions arbeiten mit `service_role` — auf
-- 17 Tabellen waeren sie mit einem Berechtigungsfehler abgebrochen. Und eine Policy ohne
-- das zugehoerige GRANT laeuft ins Leere: RLS entscheidet, WELCHE Zeilen jemand sieht,
-- das GRANT entscheidet, ob er die Tabelle ueberhaupt anfassen darf. Fehlt es, bekommt
-- ein angemeldeter Mensch einen Fehler statt seiner eigenen Zeilen.
--
-- WARUM NICHT EINFACH DIE VORGABE WIEDERHERSTELLEN: weil die Supabase-Vorgabe `grant all
-- ... to anon` enthaelt, und genau davon will M3 weg. Die Rechte werden hier ausdruecklich
-- je Tabelle gesetzt — das ist M3s Ziel, und der Rueckweg hat es unfreiwillig erzwungen.
--
-- ENG, NICHT PAUSCHAL: fuer `authenticated` werden genau die Verben vergeben, die die
-- Policies der Tabelle fuer `authenticated` abdecken — an pg_policy.polcmd nachgemessen,
-- nicht geraten. Drei Tabellen bekommen deshalb NUR SELECT (sie werden ausschliesslich
-- von Edge Functions geschrieben), eine bekommt kein UPDATE (style_references hat dafuer
-- keine Policy). `anon` bleibt hier unberuehrt: wer oeffentlich lesen darf, ist eine
-- eigene Entscheidung und gehoert in den zweiten Teil von M3, nicht in eine Reparatur.

-- ── service_role: die Edge Functions muessen arbeiten koennen. ──────────────────
-- service_role umgeht RLS ohnehin; ein fehlendes GRANT ist kein Schutz, sondern ein
-- kaputter Betrieb. 17 Tabellen, an denen es fehlte.
grant all on public.ai_budget_ledger,
             public.cultural_currents,
             public.designer_automations,
             public.designer_opportunities,
             public.edition_participants,
             public.editions,
             public.house_settings,
             public.house_signatures,
             public.inbound_email_events,
             public.kunden_stil,
             public.page_visits,
             public.partie_zuege,
             public.pawn_signals,
             public.style_references,
             public.video_assets,
             public.zugang_bootstrap,
             public.zugang_protokoll
  to service_role;

-- ── authenticated: genau die Verben, die die Policies decken. ───────────────────
-- Volle Schreibrechte, weil die Tabelle eine FOR-ALL-Policy fuer authenticated hat
-- (Eigentuemer verwaltet seine Zeilen, Admin verwaltet alles):
grant select, insert, update, delete on
  public.ai_budget_ledger,
  public.cultural_currents,
  public.designer_automations,
  public.designer_opportunities,
  public.edition_participants,
  public.editions,
  public.house_settings,
  public.house_signatures,
  public.inbound_email_events,
  public.video_assets
  to authenticated;

-- Nur Lesen: diese drei werden ausschliesslich von Edge Functions mit service_role
-- geschrieben, und ihre Policies geben authenticated auch nur SELECT.
grant select on public.page_visits, public.partie_zuege, public.pawn_signals to authenticated;

-- style_references: SELECT, INSERT, DELETE — kein UPDATE, denn dafuer gibt es keine
-- Policy. Ein Bild ersetzt man, indem man es loescht und neu hochlaedt.
grant select, insert, delete on public.style_references to authenticated;

-- ── WAS BEWUSST OHNE RECHTE BLEIBT, jedes mit Grund. ──────────────────────────
-- rate_limit_hits: ihre Datei sagt es ausdruecklich — "Nur der Service-Role-Schluessel
--   darf hier lesen/schreiben, kein Client-Zugriff, weder anon noch authenticated."
--   Sie hat ihr service_role-GRANT schon und braucht hier nichts.
-- zugang_bootstrap, zugang_protokoll: RLS an, KEINE Policy. Das ist Absicht (nur
--   service_role und SECURITY-DEFINER-Funktionen kommen heran) und der Gegenstand von
--   M4 — dort werden sie als dokumentierte Ausnahme eingetragen, nicht hier geoeffnet.
