# Revision 03 — Anschlussfähig (10. September 2026)

Ziel dieser Revision: Der Prototyp wird ohne Umbau seiner Module in das echte Projekt `pawn-prototype` einziehen können. Sichtbar ändert sich in der Vorschau nichts — außer dass `index.html` jetzt über `boot.mjs` startet und es eine zweite Seite `probe-echt.html` gibt.

## Neu
- `app.js` exportiert `startHeft(optionen)` (Quelle, Adressart, Asset-Basis, Zustimmung, Rückrufe) und gibt `{go, route, state, refresh, stop, kontoLaden}` zurück. `boot.mjs` startet die Vorschau mit `demoQuelle()`.
- `quelle.mjs` — der Port: `demoQuelle()` und `supabaseQuelle({client, bild, funktionen, sichten})` mit Spaltenmasken (`SPALTEN`), Kasse je Haus, Anfrage mit Login-Pflicht, Bewerbung, Stil/Maße/Merkliste/Bestellungen, Signale, Konto.
- `adapters.mjs` — neu geschrieben gegen `types.ts`: Produkte (Größen, Bestand, `product_dna.kind`, `product_dna.heft`), Häuser (Welt aus `tags`, Bausteine nur bei veröffentlichter Seite, Theme `farbwelt.{bg,fg,accent,muted}`), Medien, Kuration, Bestellungen, Stilprofil, Kassenzeilen.
- `routen.mjs` — Route ↔ Pfad, Umzüge, `alleAdressen()`, Adressadapter `hash|pfad`.
- `data.mjs › heftFuellen()` — Sektionen und Bühnen aus Häusern, Leerzustände je Welt, redaktionelle Reihe; `demoWiederherstellen()`; `assetBasis()`.
- `fixtures/zeilen.mjs`, `probe-echt.html`/`boot-probe.mjs` — das Heft mit Zeilen in Datenbankform (drei Werke tragen `product_dna.heft.cutout_url`).
- `anschluss.test.mjs` — 11 Tests (27 gesamt).
- `sql/01–04` — Sichten, `kunden_stil`, `customer_measurements.raum`, `product_dna.heft`.
- `docs/INTEGRATION.md` (Vertrag), `docs/AUFTRAG-INTEGRATION.md` (Auftrag an Claude Code), `docs/backend-inventar.md` (Ist-Zustand des Backends).

## Geändert (Nachtrag 10. Sep, für den Einzug)
- `dreiD.mjs` — die einzige Datei, die Three.js importiert. Vorschau: `vendor/`. Im Projekt wird nur diese Datei getauscht (`dreiD.projekt.mjs` liegt daneben). `world.mjs` kennt Three.js nicht mehr direkt.
- `style.css` trägt keine `@font-face`-Regeln mehr; sie stehen in `vendor-schriften.css`, das `index.html` und `probe-echt.html` zusätzlich laden. So zieht `style.css` unverändert um.
- `demoHeft()` trägt jetzt `demo:true` — sonst hätte `heftFuellen` auch die Beispieldaten umgebaut und die Bühne wäre leer geblieben (gefunden beim Prüflauf nach der Bühnen-Regel).

## Geändert
- `beratung.mjs › urteil` liest die Stil-DNA des Stücks über ein Vokabular je Welt statt einer Id-Liste.
- `kuration.mjs` — Bühne eines Hauses zeigt nur seine Stücke; leere Welten stürzen nicht; redaktionelle Reihe vor Regel-Kuration.
- `world.mjs` — Standhöhe aus `product.stage`, nicht aus Ids.
- `cutouts.mjs` — freigestellte Fassung des Hauses oder Beispiel-Freistellung; **nie das Produktfoto** (Fotokarten waren kurz drin und wurden auf Daoudas Wunsch verworfen). Bühne zeigt nur `buehnenfaehig`e Werke.
- `views.mjs` — Tasche gruppiert je Haus (eine Zahlung je Haus, wie `create-checkout`); Vorschau-Hinweise nur im Demo-Modus.
- `extra-views.mjs` — Chat-Antworten aus der Quelle (`antwortHtml`), Bestellzeilen (`bestellZeilen`), keine festen Produkt-Ids mehr.
- `model.mjs` — `massanfertigung` ist ein Anfrage-Typ.
- `store.mjs › massZeile` — schreibt `raum` als JSON zusätzlich zu `room_note`.
- Kleinigkeiten: „PAWN / AUSGABE 03" statt „THE FIRST EDITION" überall, BEWEGTBILD-Stempel weg, „Plissé", Sprechblase `aria-live="off"`.

## Bewusst nicht gemacht (steht im Auftrag)
- Port von `computeFit`, Foto-Analyse (`pawn-chat mode:stilfoto`), Vision-Text aus `site_content`, EN-Fassung, Freistell-Function, Seitenbesuche/Plausible.
