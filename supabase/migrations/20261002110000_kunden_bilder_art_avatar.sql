-- D1: die Oberfläche legt Ganzkörperbilder als art='avatar' an (so heißt die Seite).
-- Die Prüfregel wird nur erweitert, nichts Bestehendes fällt weg.
alter table public.kunden_bilder drop constraint if exists kunden_bilder_art_check;
alter table public.kunden_bilder add constraint kunden_bilder_art_check
  check (art = any (array['ganzkoerper'::text, 'avatar'::text, 'portrait'::text, 'raum'::text, 'wand'::text]));