-- Teil 28a — PAWN wird Person: Figur überall.
-- Zwei neue, eigenständige Felder auf designers (Erweiterung, keine bestehenden Constraints angefasst):
--   - pawn_guide_enabled: Schalter für die Scroll-Begleitung im Studio (Einstellungen, Default an).
--   - studio_last_seen_at: letzter Studio-Besuch, Grundlage für "Während du weg warst".

alter table public.designers
  add column if not exists pawn_guide_enabled boolean not null default true;

alter table public.designers
  add column if not exists studio_last_seen_at timestamptz;

comment on column public.designers.pawn_guide_enabled is 'Ob PAWN als Scroll-Begleitung im Studio erscheint (Teil 28a). Abschaltbar in den Einstellungen.';
comment on column public.designers.studio_last_seen_at is 'Zeitpunkt des letzten Studio-Besuchs. Grundlage für den "Während du weg warst"-Moment (Teil 28a). Wird beim Öffnen des Studio-Hubs aktualisiert.';
