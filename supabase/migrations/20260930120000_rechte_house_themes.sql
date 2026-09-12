-- Die drei Tabellenrechte auf public.house_themes, die in der Kette verloren gingen.
--
-- WARUM DIESE DATEI EXISTIERT, belegt am 11.09.2026 beim Abspielen der Kette:
-- house_themes wird im Repo ZWEIMAL angelegt — einmal in der gebuendelten
-- Lovable-Migration 20260729052933 (Abschnitt „Datei 3") und einmal in
-- 20260731090000_house_themes.sql. Nur das Buendel traegt die drei GRANTs.
--
-- Spielbar ist aber nur die Einzeldatei: die Policy des Buendels liest
-- designers.page_published_at, eine Spalte, die erst 20260729093000 anlegt
-- (gemessen: 42703: column d.page_published_at does not exist). Das Buendel ist
-- deshalb in scripts/db/deckung.json als ganz gedeckt eingetragen — und damit waere
-- house_themes OHNE jedes Tabellenrecht angelegt worden.
--
-- Was das bedeutet, wenn es fehlt: RLS entscheidet, WELCHE Zeilen jemand sieht. Das
-- GRANT entscheidet, ob er die Tabelle ueberhaupt anfassen darf. Ohne `GRANT SELECT
-- ... TO anon` laeuft die Policy „public reads current theme of published pages" ins
-- Leere — eine veroeffentlichte Hausseite kann ihre eigene Welt nicht lesen, und zwar
-- mit einem Berechtigungsfehler, nicht mit einer leeren Antwort. Genau diese Sorte
-- Luecke sucht M3.
--
-- Die Rechte sind Zeichen fuer Zeichen die des Buendels, nichts dazu, nichts weg.
GRANT SELECT                           ON public.house_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE   ON public.house_themes TO authenticated;
GRANT ALL                              ON public.house_themes TO service_role;
