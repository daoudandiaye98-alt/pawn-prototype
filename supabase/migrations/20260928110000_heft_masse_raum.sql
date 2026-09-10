-- Teil H — das Heft. Quelle dieser Datei: src/heft03/sql/03_customer_measurements_raum.sql
-- Dort steht sie als Vertrag des Hefts; hier steht sie als Migration.
-- Wer eine aendert, aendert beide — sonst laeuft der Vertrag von der Datenbank weg.
-- Anwenden NUR ueber den Lovable-Agenten, nie von Hand im Dashboard (CLAUDE.md).

-- customer_measurements: Interior- und Kunst-Maße strukturiert.
-- Heute: nur Körpermaße (Mode) + room_note als Freitext. Das Heft fragt je Welt anders:
--   Interior: Wand/Stellfläche (cm), Raumhöhe, Licht, Abstand · Kunst: freie Wandfläche, Höhe, Licht, Umgebung.
-- massZeile() (store.mjs) schreibt weiterhin room_note als lesbaren Satz UND, sobald die Spalte existiert, raum als JSON.

alter table public.customer_measurements
  add column if not exists raum jsonb;

comment on column public.customer_measurements.raum is 'Heft-Raummaße {wand, hoehe, flaeche, licht, abstand} für Interior/Kunst; room_note bleibt der lesbare Satz.';

-- Bestehende RLS (eigene Zeile) deckt die neue Spalte ab; keine neue Policy nötig.
