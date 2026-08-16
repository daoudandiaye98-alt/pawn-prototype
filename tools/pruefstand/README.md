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

Kam eine Seite nicht an ihre Daten — Anfragen an `DATEN_HOSTS` (Supabase) sind
fehlgeschlagen —, dann werden **alle** Befunde dieser Seite auf `nicht_pruefbar` gesetzt,
mit Grund und ursprünglicher Messung in der Notiz. Kein `bestanden`, kein `gefallen`.

Der Grund: ohne Daten zeigt der Browser ein Gerüst. Der Kontrast stimmt, weil nichts
dasteht. Die Trefferflächen stimmen, weil es keine gibt. Der primäre Weg ist frei, weil
der Fuß nach oben gerutscht ist. Ein `bestanden` wäre hier gefährlicher als ein
`gefallen` — es sähe aus wie ein Beleg.

**Praktische Folge:** im Entwicklungscontainer hat der Browser keinen Ausgang ins Netz
(curl schon, Chromium nicht — belegt: der Proxy protokolliert bei HTTPS kein CONNECT).
Damit sind dort **alle** Seiten Hüllen, auch `/`. Ein `--ziel lokal`-Lauf taugt zum
Entwickeln des Prüfstands, liefert aber keine abnahmefähigen Zahlen mehr.

## Stufe 2 — der Lauf auf dem Runner

`.github/workflows/pruefstand.yml`: bei jedem Push auf jeden Zweig, gegen **pawn.vision**.
Der Runner hat Netz — er ist der einzige Ort, an dem `/shop`, `/product` und `/designer`
echte Zahlen bekommen. `bericht.json` und die Aufnahmen hängen als Artefakt am Lauf (auch
am roten). Gefallenes Launch Gate → Exit 1 → Check rot.

Gemessen wird der **ausgelieferte** Stand, nicht der Stand des Commits, der den Lauf
ausgelöst hat. Solange der Push noch nicht veröffentlicht ist, beschreibt der Bericht den
Zustand davor; `ziel`, `adresse` und `commit` stehen im Bericht, damit sich das
auseinanderhalten lässt.
