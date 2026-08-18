# Der Prüfstand

Ein Skript öffnet die Seite in einem echten Browser, misst vier Breiten durch und
schreibt **Zahlen** in eine Datei.

Er misst und schreibt auf. Er bewertet nicht. Im Bericht steht, was gemessen wurde und
gegen welche Schwelle — nie, ob das „gut" ist. Wer Messung und Bewertung in dasselbe
Werkzeug legt, bekommt eine Meinung statt eines Befunds.

## Einmalig einrichten

```bash
npm install                      # Playwright & tsx stehen in devDependencies
npx playwright install chromium  # lädt den Browser (nicht ins Repo)
```

Bringt die Umgebung bereits ein Chromium mit (Container, CI), genügt stattdessen:

```bash
export PRUEFSTAND_CHROMIUM=/opt/pw-browsers/chromium
```

## Starten

```bash
npx tsx tools/pruefstand/lauf.ts --ziel preview   # Vorgabe
npx tsx tools/pruefstand/lauf.ts --ziel live
npx tsx tools/pruefstand/lauf.ts --ziel lokal
```

Nur ein Ausschnitt (schnell, beim Nachbessern):

```bash
npx tsx tools/pruefstand/lauf.ts --ziel lokal --seiten halle --breiten 390
```

### Die vier Ziele

| Ziel | Adresse | Anmerkung |
|---|---|---|
| `preview` | `id-preview--81416573-…lovable.app` | Editor-Vorschau. **Nur mit angemeldeter Lovable-Sitzung erreichbar** — ohne Anmeldung antwortet sie mit 302 auf `lovable.dev/auth-bridge`. Der Prüfstand erkennt das und meldet `nicht_pruefbar`, statt eine Anmeldeseite zu vermessen. |
| `vorschau` | `pawn-archive-muse.lovable.app` | Die veröffentlichte Lovable-Vorschau, öffentlich erreichbar, gleicher Stand. |
| `live` | `pawn.vision` | Was Kundinnen sehen. |
| `lokal` | `http://127.0.0.1:4173` | Der gebaute Stand aus diesem Arbeitsverzeichnis. Misst denselben Code, der veröffentlicht würde — **vor** dem Push. |

Für `lokal` vorher:

```bash
npm run build
npx vite preview --port 4173     # in einem zweiten Fenster laufen lassen
```

### Wenn der Browser nicht ins Netz kommt

In abgeschotteten Umgebungen (dieser Container zum Beispiel) hat das gestartete Chromium
keinen Ausgang: jede öffentliche Adresse endet mit `ERR_CONNECTION_RESET`, obwohl `curl`
dieselbe Seite mit 200 holt. Dann ist `--ziel lokal` der einzige Weg zu echten Zahlen —
er misst den gebauten Stand, nicht die Live-Seite. Der Bericht sagt in `ziel`/`adresse`
immer, was tatsächlich vermessen wurde.

## Was gemessen wird

| Kontrolle | Was |
|---|---|
| 3.3 | Kontrast, über die **ganze Seite** (fensterweise durchgerollt, weil die Verdeckungsprüfung nur im sichtbaren Fenster arbeitet). Liegt Text über einem Bild, wird nicht die CSS-Farbe genommen, sondern der hellste Bildpunkt **hinter der Schrift** — dafür werden zwei Aufnahmen desselben Ausschnitts verglichen (einmal mit, einmal ohne Glyphen) und nur die Punkte gewertet, die sich unterscheiden. Vorher wird jede Bewegung stillgestellt, sonst misst man Animation statt Schrift. |
| 3.4 | Sichtbarer Tastaturfokus — Pixelvergleich vor und nach `focus()`. |
| 3.5 | Trefferflächen ≥ 44 × 44 px, nur bei Fingerbreiten (390, 768). |
| 3.7 | Ein Screenshot je Seite und Breite nach `artefakte/<seite>--<breite>.png`. |
| 3.8 | Waagerechter Überlauf, Überschneidungen, abgeschnittener Text. |
| 3.9 | Zweiter Durchlauf mit `prefers-reduced-motion: reduce`. |
| 3.10 | Ist der primäre Knopf verdeckt? Über `elementFromPoint` auf seiner Mitte. Als primär gilt das größte beschriftete Bedienelement des ersten Bildschirms **außerhalb** von Kopfzeile, Navigation und aufgelegten Schichten — sonst gewinnt der Knopf des Einwilligungs-Dialogs, und die Kontrolle beantwortet nicht mehr die Frage, ob die Seite ihren Weg zeigt. |
| 4.3 | Alle internen Wege von `/` werden angesteuert (bis 40). Externe Ziele und `mailto:`/`tel:` werden bewusst nicht angefasst. |
| 4.5 | Eine erfundene Adresse: Status und ob ein Weg zurück existiert. |
| 4.7 | Gewicht der Seite in Byte, mit den zehn größten Antworten. |
| 5.1 · 5.2 · 5.4 | Titel, Beschreibung, Überschriftenordnung, Open-Graph-Bild. |
| — | Konsolenfehler und fehlgeschlagene Anfragen (kein Gate, aber im Bericht). |

Alle Schwellwerte stehen in `pruefstand.config.ts`. Keine Zahl ist im Messcode vergraben.

**Dauer:** ein voller Lauf (4 Seiten × 4 Breiten + Bewegung-reduziert + Wege) braucht rund
25–30 Minuten. Der Löwenanteil sind die Kontrast-Aufnahmen und das Absuchen aller internen
Wege. Beim Nachbessern lohnt `--seiten … --breiten …`.

## Der Fokus-Wächter (Teil K2)

```bash
node tools/pruefstand/fokus-waechter.mjs
```

Eine Sekunde, kein Browser. Er sucht Stellen, die den Tastatur-Rahmen wegnehmen
(`focus:outline-none`, `outline: none`), ohne an derselben Stelle einen eigenen
zu setzen. Solche Stellen sieht man mit der Maus nie — und die Grundregel aus
`src/index.css` steht in der Basis-Schicht, wird also von jeder Tailwind-Klasse
überstimmt.

Er misst nicht, ob der Fokus sichtbar IST — das tut Kontrolle 3.4 am echten
Bild. Er verhindert nur, dass wieder eine blinde Stelle dazukommt. Zwei
Ausnahmen stehen im Kopf des Skripts, jede mit Grund. Endet mit Code 1 bei einem
Fund; läuft in der Action vor dem Browser.

## Der Wendel (Teil M)

Der Prüfstand misst die Launch Gates. Ob das Blatt richtig dreht, ist eine andere
Frage — dafür gibt es ein zweites Skript:

```bash
node tools/pruefstand/wendel.mjs
```

Es prüft auf vier Breiten: Dokumenthöhe, Winkel und Stapelordnung an jedem
Achtelschritt, Knickstärke, Tastaturrollen, Tieflink, Adressnachführung, den zweiten
Weg bei reduzierter Bewegung und den Inhalt im DOM. Endet mit Code 1 bei Abweichung.

**Achtung beim Messen:** die Seite hat `scroll-behavior: smooth`. Wer mit
`window.scrollTo(0, y)` springt, misst die Rollanimation statt das Blatt —
`behavior: "instant"` verwenden.

## Der Bericht

`artefakte/bericht.json`:

```json
{
  "ziel": "lokal",
  "adresse": "http://127.0.0.1:4173",
  "zeitpunkt": "…",
  "commit": "…",
  "gates": { "bestanden": 0, "gefallen": 0, "nicht_pruefbar": 0 },
  "befunde": [ … ]
}
```

Ein Befund hat genau einen von drei Status: `bestanden`, `gefallen`, `nicht_pruefbar`.

- `nicht_pruefbar` trägt **immer** eine `notiz`, die sagt **warum**.
- Jeder Befund nennt `gemessen` **und** `schwelle`. Ein Befund ohne Zahl ist kein Befund.

Exit-Code **1**, sobald ein Launch Gate gefallen ist. Sonst **0**.

## Regeln

- Kein Produktionscode wird verändert. `tools/pruefstand/` wird aus `src/` nie importiert
  (`grep -rn "pruefstand" src/` bleibt leer).
- Playwright, tsx und pngjs stehen in `devDependencies` — nichts davon landet im Bundle.
- Screenshots und Bericht liegen in `artefakte/` und sind in `.gitignore`. Nie committen.

## Die Hüllen-Regel

> **Eine Seite, die ihre Datenschicht nicht erreicht, ist NIE `bestanden`.**

Das ist die Regel. Sie gilt ohne Ausnahme und unabhängig davon, woran es lag. Alle
Befunde einer solchen Seite werden auf `nicht_pruefbar` gesetzt, mit Grund und
ursprünglicher Messung in der Notiz. Kein `bestanden`, kein `gefallen`.

Der Grund: ohne Daten zeigt der Browser ein Gerüst. Der Kontrast stimmt, weil nichts
dasteht. Die Trefferflächen stimmen, weil es keine gibt. Der primäre Weg ist frei, weil
der Fuß nach oben gerutscht ist. Ein `bestanden` wäre hier gefährlicher als ein
`gefallen` — es sähe aus wie ein Beleg.

Eine Seite kann auf **zwei** Wegen zugeben, dass sie ohne Daten dasteht. Beide führen
zum selben Urteil; es ist eine Regel, nicht zwei.

**1 · Die Anfrage kam nicht durch.** Anfragen an `DATEN_HOSTS` (Supabase) sind
fehlgeschlagen — `requestfailed`, also Transportfehler: Name nicht auflösbar, Verbindung
abgebrochen, kein Proxy. `huelleMarkieren()` in `lauf.ts` erledigt das.

**2 · Die Seite sagt es selbst: `data-daten-fehlen`.** Trägt irgendein Element auf der
Seite dieses Kennzeichen, ist die Seite nicht prüfbar. Sie setzt es, während sie lädt und
wenn ihre Abfrage mit einem Fehler geantwortet hat.

Weg 2 ist nicht überflüssig, sondern deckt genau die Fälle, die Weg 1 nicht sieht:

- **Die Anfrage gelingt, die Antwort ist ein Fehler.** RLS verweigert den Lesezugriff →
  HTTP 401/403. `requestfailed` löst dabei nicht aus, denn die Anfrage KAM durch. Für
  Weg 1 ist alles in Ordnung, die Seite ist trotzdem leer.
- **Die Abfrage läuft noch.** `RUHE_MS` war kürzer als die Antwort brauchte.

Gemessen, nicht vermutet: im Lauf vom 17.08. gegen die lokale Vorschau von
`/verzeichnis/1` schlug bei **einem** von sieben Seitenläufen eine Supabase-Anfrage fehl —
nur dort griff Weg 1. Die anderen sechs zählten als richtige Messungen, obwohl der
Katalog seinen Fehlersatz zeigte. Genau dieses Loch schließt Weg 2.

**Was NICHT gekennzeichnet wird:** ein Katalog, der leer ist, weil es keine Ware gibt.
Das ist ein echter Zustand mit einem echten Satz auf der Seite, und er wird gemessen. Der
Unterschied ist nicht kosmetisch — er entscheidet, ob eine Zahl etwas bedeutet.

**Praktische Folge:** im Entwicklungscontainer hat der Browser keinen Ausgang ins Netz
(curl schon, Chromium nicht — belegt: vier Proxy-Schreibweisen durchprobiert, keine
erreicht lokales Ziel UND Datenhost). Damit sind dort **alle** datentragenden Seiten
Hüllen. Ein lokaler Lauf taugt zum Entwickeln des Prüfstands, liefert aber keine
abnahmefähigen Zahlen. Abgenommen wird auf dem Runner.

## Stufe 2 — der Lauf auf dem Runner

`.github/workflows/pruefstand.yml`, bei jedem Push auf jeden Zweig. Der Runner hat Netz —
er ist der einzige Ort, an dem Vorschau und echte Daten zusammen messbar sind.
`bericht.json` und die Aufnahmen hängen als Artefakt am Lauf (auch am roten). Gefallenes
Launch Gate → Exit 1 → Check rot.

**Welches Ziel gemessen wird**, in dieser Reihenfolge:

| Fall | Ziel | Was der Bericht beschreibt |
|---|---|---|
| Adresse von Hand eingetragen (`workflow_dispatch`) | diese Adresse | was dort steht |
| Zweig ≠ Hauptzweig **und** `VERCEL_AUTOMATION_BYPASS_SECRET` gesetzt | **die Vercel-Vorschau dieses Zweigs** | den Stand **dieses Commits** |
| sonst | **pawn.vision** | den **ausgelieferten** Stand, also ggf. den Zustand VOR diesem Push |

Der zweite Fall ist der Sinn dieser Stufe: nur dort messen die Zahlen den Zweig, auf dem
gearbeitet wird. Ohne Geheimnis fällt die Action auf pawn.vision zurück, statt
stillzustehen — sie schreibt in beiden Fällen ins Protokoll, was sie gemessen hat, und
`ziel`, `adresse` und `commit` stehen im Bericht.

**Die Vorschau-Adresse wird nicht geraten.** Sie enthält einen gekürzten, gehashten
Zweignamen (`…-git-claude-357453-…`), der aus dem Zweignamen nicht ableitbar ist. Gelesen
wird sie dort, wo Vercel sie hinterlegt: `environment_url` im Status der GitHub-Deployment
zu diesem Commit (`production_environment = false` trennt Vorschau von Produktion). Ist
nach 15 Minuten keine fertige Vorschau da, bricht der Lauf ab und listet die gefundenen
Deployments — **kein stiller Rückfall auf pawn.vision**: ein Lauf, der etwas anderes
gemessen hat als er sollte, ist schlimmer als ein roter Lauf.

## K7 · Kontrolle 4.5 — acht Versuche, kein 404

Hinter der SPA-Umschreibung antwortet jede erfundene Adresse mit 200. Ein Statuscode
lässt sich nur **vor** der Umschreibung setzen. Beide Wege dorthin wurden gebaut und
gegen die eigene Vorschau gemessen; keiner hat gegriffen.

| Weg | Fassungen | Ergebnis auf der Vorschau |
|---|---|---|
| Edge Middleware (`middleware.ts`) | 7 — mit/ohne `config.matcher`, Import ohne Endung, mit `.js`, `routen` als echtes JS, Kekse und Bypass-Kopfzeile weitergereicht, zuletzt die dokumentierte Nicht-Next-Fassung mit `next()` aus `@vercel/functions` | Status 200, **keine** Kopfzeile — auch nicht die des Rücktritts |
| `vercel.json` mit `routes` + `status: 404` | 1 | Status 200, **keine** Kopfzeile |

Geprüft und ausgeschlossen: Root Directory ist nicht gesetzt (also Repo-Stamm, die Datei
lag richtig); Vite ist kein Ausschlussgrund, Routing-Middleware gibt es auch ohne Next.js;
alle anderen Seiten wurden im selben Lauf normal geliefert, der Umbau hat nichts beschädigt.

**Was NICHT gemessen ist:** ob es auf pawn.vision anders aussieht. Die Vorschau ist durch
Deployment Protection gesperrt, der Prüfstand kommt mit `x-vercel-protection-bypass` hinein.
Ob diese Schicht vor dem Routing sitzt und autorisierte Anfragen an Middleware und `routes`
vorbei ausliefert, ist eine Hypothese — sie passt zu allem Beobachteten, ist aber ungeprüft.
Der Test dazu ist ein Befehl auf der ungesperrten Produktion:

    curl -I https://pawn.vision/diese-seite-gibt-es-nicht-4d9f21

`404` und `x-pawn-404: vercel-json` hieße: die Lösung trägt, nur die gesperrte Vorschau kann
sie nicht messen. `200` hieße: sie ist wirkungslos und `vercel.json` gehört auf die einfache
`rewrites`-Form zurück.

`middleware.ts` und `@vercel/functions` sind entfernt — sieben Fassungen lang haben sie
nichts getan, und eine tote zweite Fassung derselben Sache ist genau das, was hier verboten
ist. Geblieben ist, was unabhängig davon trägt: `routen.js` als einzige Adressliste,
`tools/vercel-routen.mjs` als Erzeuger von `vercel.json` und zwei Wachen
(`src/__tests__/routen.spec.ts`, `src/__tests__/vercel-routen.spec.ts`).

## Dokumentierte Ausnahmen

Eine Kontrolle darf auf REVIEW stehen und trotzdem ausgeliefert werden — aber nur als
**dokumentierte Ausnahme**, und die braucht vier Angaben (ZERA-QA 06). Ohne
Verantwortlichen und Termin ist es keine Ausnahme, sondern ein verschwiegener Fehler.
Erledigte Ausnahmen bleiben mit Datum stehen: die Liste ist ein Protokoll, kein Aushang.

### A1 · Einzelseiten-Geometrie im Browser ungemessen

| | |
|---|---|
| **Sache** | Die Einzelseiten-Geometrie (Blattverhältnis 0,72 · Untergrenze 320 px · Satzspiegel unter 430 px Höhe) ist im Browser ungemessen. Die Rechnung dahinter ist es nicht — `src/heft/__tests__/einzelseite.spec.ts` prüft sie mit zehn Tests. Ungemessen ist, wie sie **aussieht**. |
| **Grund** | Messbar erst auf dem Runner gegen die Vorschau des Zweigs. Der Entwicklungscontainer bringt Browser und Netz nicht zusammen (s. Hüllen-Regel), und ohne `VERCEL_AUTOMATION_BYPASS_SECRET` misst die Action pawn.vision statt des Zweigs. |
| **Verantwortlich** | Daouda |
| **Termin** | mit dem ersten Action-Lauf, der das Geheimnis hat |
| **Betroffen** | `/heft/…`, `/verzeichnis/…`, `/werk/…`. Die Landing `/` und alle Kundenseiten davor bleiben unberührt — das Heft liegt auf eigenen Adressen und ist nicht indexiert. Das Risiko ist damit eingezäunt. |

### K7 · Kontrolle 4.5 — erfundene Adressen antworten mit 200

| | |
|---|---|
| **Sache** | Eine Adresse, die es nicht gibt, antwortet mit Status 200 statt 404. Der Mensch sieht die richtige Seite mit dem Weg zurück; eine Suchmaschine hält die erfundene Adresse für gültig und kann sie indexieren. |
| **Grund** | Acht Fassungen über zwei unabhängige Mechanismen (Edge Middleware, `vercel.json`-`routes`) greifen auf der Vorschau nicht — Ursache unbekannt. Offene, ungeprüfte Spur: die Deployment Protection der Vorschau könnte vor dem Routing liegen. Der entscheidende Test läuft auf pawn.vision, s. Abschnitt K7 oben. |
| **Verantwortlich** | Daouda |
| **Termin** | offen — bewusst ohne Datum entschieden, keine weiteren Versuche |
| **Betroffen** | Nur erfundene Adressen. Alle echten Seiten wurden im selben Lauf gemessen und sind unberührt; Kauf-, Anmelde- und Heft-Wege sind nicht betroffen. Das Risiko ist SEO-Rauschen, kein Ausfall. |
