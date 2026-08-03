## Ziel

Eine Seite **„PAWNs Vision"** unter `/vision` — kein Funktionsüberblick, kein Wort über Geld. Sie beschreibt, was für ein Ort PAWN ist: ein Haus, in dem sich unabhängige Gestalter versammeln, und in dem Menschen sie finden. Wer dort landet, versteht sofort, wofür PAWN steht und wohin er als Nächstes geht.

## Ton

Editorial, ruhig, erste Person Plural. Große Serifensätze, viel Weißraum, streng schwarz/weiß, harte Kanten. Keine Preise, keine Prozentsätze, keine Plan- oder Konditionsangaben. Positiv formuliert — die Gegenwart wird benannt, der Text bleibt eine Einladung.

## Aufbau

1. **Manifest-Kopf** — ein einziger großer Satz, sinngemäß: „Ein Ort für die, die noch selbst machen." Darunter eine Zeile Kontext.
2. **Warum es uns gibt** — drei bis vier Sätze: Vieles wird heute im Wochentakt produziert und im Feed vergessen. Die Menschen dahinter bleiben unsichtbar. Wir bauen den Gegenort — langsam, kuratiert, mit Namen.
3. **Was für ein Ort das ist** — vier Überzeugungen, je Überschrift + zwei Sätze:
   - **Ein Haus, kein Feed** — Arbeiten bekommen Raum statt Scroll-Sekunden.
   - **Jedes Stück hat eine Herkunft** — wer es gemacht hat, woraus, warum.
   - **Wenige statt viele** — kuratiert. Was hier steht, soll bleiben.
   - **Die Gestalter behalten ihre Handschrift** — PAWN gibt Werkzeuge, keine Vorgaben.
4. **Eine Versammlung** — kurzer Absatz als Einladung an Mode-, Interior- und Kunstschaffende: hier findet ihr einander und ein Publikum, das genau danach sucht. Ein Link: *Werde Teil davon* (`/apply`).
5. **Für die, die suchen** — kurzer Absatz an Besucher: nicht Katalog, sondern Ausstellung. Links: *Ausstellung ansehen* (`/shop`), *Deine DNA* (`/dna`).
6. **Die Welten** — Mode · Interior · Kunst als drei Links (`/mode`, `/interior`, `/kunst`).
7. **Zähler ganz unten** — große Zahlen in Serifenschrift, live aus der Datenbank:
   - Häuser (Anzahl veröffentlichter Häuser)
   - Länder (Anzahl verschiedener Länder dieser Häuser)
   - Welten (Mode · Interior · Kunst)
   Solange die Zahlen klein sind, steht daneben ehrlich: „Die ersten Häuser ziehen ein." Keine erfundenen Werte.

## Technisch

- Neue Datei `src/pages/Vision.tsx` mit `PalaceLayout` (Header, Footer, SEO kommen von dort), Titel und Beschreibung als Props.
- Routen in `src/App.tsx`: `/vision`, Alias `/about` auf dieselbe Seite.
- Zähler: eine schlanke Abfrage auf `designers` (nur `published = true`) — Anzahl Häuser und Anzahl verschiedener `country`-Werte. Bestätigt: beide Felder existieren. Ladezustand zeigt zurückhaltende Platzhalterstriche, kein Sprung im Layout.
- Alle Texte über `Editable` / `useContentValue` an `site_content` angebunden — später ohne Code änderbar; DE/EN über die bestehende Übersetzungslogik.
- Auffindbarkeit: Link „Vision" in der Fußzeilen-Spalte „Haus" (`PalaceLayout`) und im Hauptmenü (`PalaceHeader`).
- Keine Bildgenerierung, keine Edge Function, keine Migration — reine Frontend-Arbeit über Git.
- Prüfung: Typecheck grün, Ansicht bei 390 px und Desktop, alle Links angeklickt, Zählerwerte gegen die Datenbank gegengeprüft.

## Nicht enthalten

Alles zu Geld, Plänen und Konditionen (bleibt auf `/apply` und `/studio/plan`), Rechtstexte, Team- oder Gründerseite.
