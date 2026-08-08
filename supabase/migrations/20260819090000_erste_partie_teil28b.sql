-- Teil 28b — Die erste Partie: Onboarding als Gespräch statt Formular.
-- Ein neues, eigenständiges Feld auf designers (Erweiterung, keine bestehenden Constraints angefasst):
--   - onboarding_state: der ganze Verlauf der ersten Partie (Bestandsaufnahme, Reife-Einschätzung in
--     Worten, gewählte Schwerpunkte, die ersten drei vorgeschlagenen Züge, Zustimmungen zu Automatiken).
--     Bewusst ein einzelnes jsonb-Feld statt mehrerer Spalten, weil der Verlauf ein zusammenhängendes,
--     sich entwickelndes Gespräch ist, kein Satz fester Kennzahlen (gleiche Begründung wie bei
--     designers.dismissed_suggestions aus Teil 17c).

alter table public.designers
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

comment on column public.designers.onboarding_state is
  'Verlauf der ersten Partie (Teil 28b): status, aktueller Schritt, Bestandsaufnahme-Antworten, '
  'Reife-Einschätzung in Worten (kein Score), angebotene/gewählte Schwerpunkte, erste drei Züge, '
  'Automatik-Zustimmungen aus dem Gespräch (werden erst mit Teil 28c in designer_automations wirksam).';
