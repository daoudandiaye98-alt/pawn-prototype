---
name: zera-audit
description: Die verbindliche Webqualitätsnorm für PAWN — 45 Kontrollen in fünf Sektionen, davon 25 Launch Gates (ZERA-QA-04, Edition 2.0), angebunden an den Prüfstand und an sicht.sh, sodass 13 Kontrollen maschinell gemessen statt abgehakt werden. Vor JEDER Entscheidung zu Webdesign anwenden — Layout, Typografie, Abstände, Kontrast, Hero, Call-to-Action, Footer, Responsive, Bewegung, Formulare, Navigation, Assets, SEO, Meta-Daten, Deploy, Übergabe. Auch bei reinen Detailfragen („welche Schriftgröße", „ist der Abstand ok", „bau mir eine Landing") — dann als stille Entwurfsbedingung, nie als Fragebogen. Trigger: „schau dir die Seite an", „was ist an der Landing falsch", „vor dem Launch", „ist das fertig", „prüf das mal", „Screenshot", „responsive", „Kontrast", „mobil", „390", und jedes Mal, bevor etwas nach main geht.
---

# ZERA-QA-04 · Edition 2.0 — für PAWN

Fünf Sektionen, 45 Kontrollen, **25 davon Launch Gates**. Ein Launch Gate ist
nicht verhandelbar: es besteht, oder der Launch ist nicht freigegeben.

Diese Norm ersetzt keine Gestaltung. Sie legt fest, wann Gestaltung fertig ist.

## Der Sofortfilter — sechs Fragen vor jeder Antwort

1. Erkennt jemand auf dem ersten Bildschirm, für wen das ist und was es ist?
2. Gibt es genau **einen** besten nächsten Schritt — und heißt er überall gleich?
3. Hält Text gegen seinen Grund noch Kontrast, auch über einem Foto?
4. Funktioniert das mit dem Finger, mit der Tastatur, und bei 390 px?
5. Ist das, was ich hier behaupte, belegt — oder geraten?
6. Steht irgendwo noch ein Platzhalter, ein Entwurf, eine erfundene Zahl?

Ist eine davon nicht sauber beantwortet, gehört sie in die Antwort — auch
ungefragt. Die anderen bleiben still.

## Die Beweisregel — das Herzstück

Jede Kontrolle bekommt in jeder Antwort genau einen Status:

| Status | Bedeutung |
|---|---|
| **BELEGT** | Im Code gelesen oder aus einer Zahl/Aufnahme gemessen — mit Fundstelle |
| **NICHT BELEGT** | Braucht einen Browser, ein Gerät, eine echte Absendung, einen Menschen |
| **N/A** | Trifft hier nicht zu, mit Begründung |

**„Erledigt" ohne Beleg gibt es nicht.** Wer eine Kontrolle nicht prüfen kann,
benennt, **wer sie prüfen muss und womit**.

## In diesem Repo ist die Beweisregel ausführbar

Das ist der Unterschied zwischen dieser Fassung und einem Fragebogen: **13 der 45
Kontrollen misst dieses Repo selbst.** Wer sie „belegt" nennt, ohne den Befehl
gefahren zu haben, lügt gegen eine Datei, die danebenliegt.

| Kontrolle | Wer misst | Befehl |
|---|---|---|
| 3.3 Kontrast (ganze Seite, auch Text über Bild) | Prüfstand | `npm run pruefstand` |
| 3.4 Sichtbarer Tastaturfokus (Pixelvergleich) | Prüfstand | `npm run pruefstand` |
| 3.4 vorgelagert: Fokus-Rahmen weggenommen? | Fokus-Wächter | `node tools/pruefstand/fokus-waechter.mjs` |
| 3.5 Trefferflächen ≥ 44 × 44 px | Prüfstand | `npm run pruefstand` |
| 3.7 Vier Breiten angesehen | sicht.sh | `scripts/verify/sicht.sh` |
| 3.8 Überlauf, Überschneidung, abgeschnittener Text | Prüfstand | `npm run pruefstand` |
| 3.9 Reduzierte Bewegung | Prüfstand | zweiter Durchlauf |
| 3.10 Primärer Knopf verdeckt | Prüfstand | `elementFromPoint` |
| 4.1 Korb Ende-zu-Ende | Vitest | `npm test` (`korb.ende-zu-ende.spec.tsx`) |
| 4.3 Alle internen Wege erreichbar | Prüfstand **und** Z1 | `scripts/verify/regression.sh` |
| 4.5 404-Behandlung | Prüfstand | erfundene Adresse |
| 4.7 Seitengewicht, zehn größte Antworten | Prüfstand | `npm run pruefstand` |
| 5.1 · 5.2 · 5.4 Titel, Beschreibung, Überschriften, OG-Bild | Prüfstand | `npm run pruefstand` |

Dazu die harten Zusagen aus `.claude/regressionen.json`: **Z2** deckt 2.7
(Platzhalter raus), **Z3** deckt 2.6 (Sprache konsistent), **Z5** deckt 3.1/3.2
für die Werkseite, **Z6** deckt 3.10 für den Preisfilter.

**Grenze, die du kennen musst:** Im Entwicklungscontainer hat der Browser keinen
Ausgang ins Netz. Jede Seite, die ihre Inhalte aus Supabase holt, ist dort eine
leere Hülle — schwarze Flächen sind dann ein Container-Artefakt, **kein Befund**.
Echte Zahlen kommen aus der GitHub-Action (`.github/workflows/pruefstand.yml`),
und nur mit gesetztem `VERCEL_AUTOMATION_BYPASS_SECRET` messen sie den Zweig
statt pawn.vision.

## Die drei Modi

**A — Entwerfen und Beraten.** Der Normalfall. Die Kontrollen sind stille
Entwurfsbedingungen. **Keine Liste zeigen.** Genannt wird nur, was am
vorgeschlagenen Entwurf tatsächlich gefährdet ist, mit Kontrollnummer.

**B — Prüfen.** Es liegt eine Seite, eine Aufnahme oder Code vor. Dann läuft die
Tabelle ab: Kontrolle, Status, Beleg. Erst die Launch Gates, dann der Rest.

**C — Bauauftrag.** Beim Schreiben eines Prompts für einen Coding-Agenten werden
die betroffenen Launch Gates **wörtlich zu Abnahmekriterien**, jedes mit einer
messbaren Antwort. Was der Agent nicht messen kann, wird ausdrücklich als „vom
Menschen zu prüfen" markiert statt weggelassen.

**Proportionalität:** Eine Frage nach einer Schriftgröße bekommt keine
45-Punkte-Liste. Das volle Audit läuft nur in Modus B oder vor einem Deploy.

---

## 01 · Audit Record

Vor jedem Audit festhalten: **Projektname · geprüfte URL oder Release · Prüfer ·
Prüfdatum · CMS enthalten · Analytics enthalten · Kontext.**

Ohne benannten Build ist ein Audit wertlos — es prüft einen Zustand, den niemand
wiederherstellen kann. Ändert sich der Build wesentlich, sind die betroffenen
Sektionen ungültig und laufen neu.

Für PAWN heißt „benannter Build": Commit-SHA **und** gemessene Adresse. Der
Prüfstandsbericht nennt beides in `ziel`, `adresse`, `commit` — genau damit sich
das nie verwechseln lässt.

## 02 · Strategy, content and proof

> Eine saubere Umsetzung gleicht kein unklares Angebot, keine unbelegte Behauptung
> und keinen widersprüchlichen Weg zur Entscheidung aus.

| # | Kontrolle | Gate |
|---|---|---|
| 2.1 | Zielgruppe ist vom ersten Bildschirm an erkennbar | ⬛ |
| 2.2 | Angebot und geschäftliches Ergebnis sind eindeutig | ⬛ |
| 2.3 | Der primäre Weg heißt an allen Entscheidungspunkten gleich | ⬛ |
| 2.4 | Wesentliche Behauptungen sind konkret, belegbar, freigegeben | ⬛ |
| 2.5 | Belege stehen nahe bei der Behauptung, die sie stützen | |
| 2.6 | Stimme und Begriffe bleiben über alle Seiten konsistent | |
| 2.7 | Platzhalter, Dubletten und Entwurfsinhalte sind entfernt | ⬛ |
| 2.8 | Rechtstexte sind vorhanden und freigegeben | ⬛ |

**Für PAWN:** 2.3 ist der Grund, warum ein Hero **einen** Weg hat. Zwei
gleichwertige Knöpfe sind kein Angebot, sondern eine Frage. — 2.7 gilt auch für
erfundene Zahlen (Beleg: `0dbd07d`, „keine erfundenen Zahlen mehr auf /portal")
und für Seed-Daten. `src/core/seed/*` hat leere Arrays; so bleibt es. Echte
Markennamen sind rechtlich verboten. — 2.6 ist der Bruchtest: ein einziges Wort
aus einer fremden Welt kostet mehr als zehn gelungene. Beleg: `66acaf8`. — 2.8:
`/agb`, `/impressum`, `/datenschutz`, `/widerruf` nur auf ausdrücklichen Wunsch
ändern.

## 03 · Interface and responsive behaviour

> Ein Responsive-Durchgang verlangt absichtsvolles Layout, lesbare Typografie,
> bedienbare Elemente und erhaltene Hierarchie — nicht bloß die Abwesenheit von
> waagerechtem Rollen.

| # | Kontrolle | Gate |
|---|---|---|
| 3.1 | Typografie folgt der freigegebenen Skala und Hierarchie | |
| 3.2 | Abstände und Ausrichtung folgen wiederholbaren Systemregeln | |
| 3.3 | Text und Bedienelemente halten ausreichend Kontrast | ⬛ |
| 3.4 | Bedienelemente haben sichtbaren Tastaturfokus | ⬛ |
| 3.5 | Trefferflächen sind mobil bequem bedienbar | ⬛ |
| 3.6 | Mobile Navigation öffnet, schließt und leitet richtig | ⬛ |
| 3.7 | Layouts wurden auf Mobil, Tablet, Laptop und breitem Desktop angesehen | ⬛ |
| 3.8 | Kein ungewolltes Abschneiden, Überschneiden, waagerechtes Rollen | ⬛ |
| 3.9 | Bewegung achtet reduzierte Bewegung und blockiert nie die Bedienung | |
| 3.10 | Hover, Fokus, Aktiv, Laden, Leer und Fehler sind absichtsvoll | |

**Für PAWN:** Kontrast wird als **Zahl** genannt (4.5:1 Fließtext, 3:1 große
Schrift und Bedienelemente), nie als „sieht gut aus" — der Prüfstand liefert die
Zahl. — 3.4 hat einen bekannten blinden Fleck: die Grundregel in `src/index.css`
steht in der Basis-Schicht und wird von jeder Tailwind-Klasse überstimmt. Der
Fokus-Wächter findet Stellen, die den Rahmen wegnehmen, ohne einen zu setzen
(Beleg: `b517fa1`, 19 Stellen). — 3.5: acht gefallene Gates in `414a31a`. — 3.10:
Leerzustände sind Entwurfsarbeit. Bei PAWN ehrlich und poetisch („Die ersten
Häuser ziehen ein."), **nie Fake-Daten**.

**Und die Design-Gesetze sind hier nicht verhandelbar:** nur #000 und #FFF,
`border-radius: 0`, Hover ist Invertierung statt Opacity, kein `font-weight: 300`.

## 04 · Functional and technical verification

> Ein Formular ist nicht geprüft, wenn die Erfolgsmeldung erscheint. Es ist
> geprüft, wenn am Ziel die richtigen Daten ankommen.

| # | Kontrolle | Gate |
|---|---|---|
| 4.1 | Jedes Formular wurde Ende zu Ende mit echter Absendung geprüft | ⬛ |
| 4.2 | Pflicht-, Fehler-, Ungültig- und Erfolgszustände wurden geprüft | ⬛ |
| 4.3 | Navigation, CTAs, externe Links, E-Mail- und Telefonlinks arbeiten | ⬛ |
| 4.4 | Termine, CRM, Zahlungen, Einbettungen, Fremdanbindungen geprüft | ⬛ |
| 4.5 | 404-Behandlung und bekannte Weiterleitungen wurden geprüft | ⬛ |
| 4.6 | Repräsentative aktuelle Browser und Geräte wurden angesehen | |
| 4.7 | Große Assets, Schriften, Skripte, Leistungsrisiken wurden angesehen | ⬛ |
| 4.8 | Secrets, private Daten, Debug-Ausgaben, Nicht-Produktionszugänge sind raus | ⬛ |

**Für PAWN:** Der Maßstab dieser Sektion ist der schärfste im Dokument und gilt
sinngemäß überall: **eine grüne Meldung ist kein Beweis.** — 4.4 heißt hier vor
allem Stripe: echter Checkout, echter Connect-Split (93 / 7), echter Webhook.
Nie am lebenden Checkout „mal eben" etwas ändern. — 4.8 ist die Kontrolle, die
Firmen ruiniert. In diesem Repo blockiert `geheimnisse.sh` den Zugriff auf `.env`
und Schlüsseldateien mechanisch. Merke trotzdem: `.env` liegt im Git und steht
nicht in `.gitignore`.

## 05 · Search, launch and handoff

> Eine Launch-Freigabe verlangt, dass jedes kritische Gate besteht. Ein offener
> Punkt braucht Verantwortlichen und Lösungsplan, bevor er als dokumentierte
> Ausnahme gilt.

| # | Kontrolle | Gate |
|---|---|---|
| 5.1 | Eindeutige Seitentitel und Beschreibungen sind gesetzt | ⬛ |
| 5.2 | Überschriftenordnung ist logisch, genau ein klarer Seitentitel | |
| 5.3 | Canonical, Indexierung, Sitemap, robots verhalten sich richtig | ⬛ |
| 5.4 | Open-Graph-Bild und Social-Text wurden geprüft | |
| 5.5 | Favicon und Anwendungssymbole stimmen | |
| 5.6 | Domain, SSL, DNS und kanonischer Host sind bestätigt | ⬛ |
| 5.7 | Rückweg, Sicherung oder Wiederherstellung ist dokumentiert | ⬛ |
| 5.8 | Konten, Zugänge, Lizenzen und Eigentum sind sicher übergeben | ⬛ |
| 5.9 | Ein benannter Freigebender hat den Produktionskandidaten geprüft | ⬛ |

**Für PAWN:** 5.6 hängt an `vercel.json` — darin steht die SPA-Weiterleitung.
Ohne sie antwortet jede Unterseite von pawn.vision mit 404. Die Datei nie löschen;
`wache.sh` blockiert das. — 5.7: der Rückweg ist ein neuer Commit auf `main`, es
gibt keinen anderen. Bei Migrationen ist der Rückweg eine **zweite** Migration. —
5.9 ist immer Daouda. Ein Agent gibt nichts frei.

## 06 · Ausnahmen

Eine Kontrolle darf auf **REVIEW** stehen und der Launch trotzdem stattfinden —
aber nur als dokumentierte Ausnahme mit vier Angaben:

**Issue · Owner · Resolution date · Approver.**

Ohne Owner und Termin ist es keine Ausnahme, sondern ein verschwiegener Fehler.

## Die Statuszeile

Jedes Audit endet mit einer Zahl, nicht mit einem Gefühl:

```
CURRENT STATUS    n launch-critical items unresolved
```

`n` zählt ausschließlich Launch Gates, die nicht auf PASS stehen. Maximum 25. Bei
`n = 0` und vollständig dokumentierten Ausnahmen ist der Launch freigegeben,
sonst nicht.

## Verhältnis zu den übrigen Teilen des Harness

- **Gesetz 4** („gib dem Agenten Augen") ist die Voraussetzung für Sektion 03.
  Ohne `sicht.sh` ist 3.7 nie mehr als eine Behauptung.
- **Gesetz 7** („Beweis vor Bericht") ist dieselbe Disziplin wie die Beweisregel
  hier, nur allgemeiner.
- Der Subagent **`pruefer`** prüft danach, ob der Bericht hält, was er behauptet.
  Diese Norm sagt, *was* zu prüfen war; er sagt, *ob* es geprüft wurde.
- Bei Konflikt gewinnt die Norm nie über eine ausdrückliche Entscheidung
  Daoudas — aber die Abweichung wird als Ausnahme mit Owner behandelt, nie
  stillschweigend übergangen.
