# Die Kennzahl

Nachfunde durch einen **Menschen** nach dem Merge. Das ist die einzige Zahl, die
zählt.

Sinkt sie über vier Wochen nicht, misst das System das Falsche — dann liegt die
Arbeit in `.claude/regressionen.json`, nicht in mehr Werkzeugen.

Jeder Nachfund löst das Ritual aus (`.claude/rules/00-gesetze.md`): Zeile in
`regressionen.json` **und** Kontrolle in `scripts/verify/`, einmal rot
vorgeführt. Ohne beides gilt der Fehler als nicht erledigt.

| Datum | PR | Nachfunde | Was | Zusage/Kontrolle daraus |
|---|---|---|---|---|
| 2026-08-17 | — | — | Turm v2 gebaut. Grundlinie: 6 Zusagen, jede rot vorgeführt. Ab hier wird gezählt. | Z1–Z6 |

## Grundlinie, gegen die gemessen wird

Vor diesem Umbau gab es keine Zahl. Was es gab, war die Commit-Geschichte: in den
letzten 200 Commits stehen **27 Commits, die mit „Fix:" beginnen** — jeder davon
ein Mangel, der nach dem Bauen gefunden wurde. Einige reparieren dieselbe Sache
zweimal (`17eacd5` und `6ecb3ee`, beide Prüfstand-Absturz).

Das ist die Grundlinie. Sinkt der Anteil der Fix-Commits in den nächsten vier
Wochen nicht, hat der Harness nichts gebracht.

## Offene Entscheidung fürs erste Ausmisten (fällig 2026-09-14)

**`pawn-kontext` hat die Latte nicht genommen.** Gemessene Evaluation gegen die
Fassung ohne Skill:

| Skill | mit | ohne | Differenz | Urteil |
|---|---|---|---|---|
| `kreuzverhoer` | 6.0/6 | 2.0/6 | **+4.0** | DEUTLICH |
| `deploy-choreografie` | 6.0/6 | 2.5/6 | **+3.5** | DEUTLICH |
| `zera-audit` | 6.0/6 | 1.5/6 | **+4.5** | DEUTLICH |
| `pawn-kontext` | 5.0/6 | 4.5/6 | **+0.5** | SCHWACH |

Die Auslöser sitzen dagegen bei allen vieren — 8 von 8 richtig, je ein Satz, der
auslösen muss, und einer, der es nicht darf:

| Satz | erwartet | gemessen |
|---|---|---|
| „Warum kann das Atelier-Haus kein Video erzeugen?" | `pawn-kontext` | ✓ |
| „Wie spät ist es in Tokio?" | KEINER | ✓ |
| „Neuer Eimer, Migration + Frontend + Function, ein PR. Bau das." | `kreuzverhoer` | ✓ |
| „Schreib eine freundliche Absage-Mail." | KEINER | ✓ |
| „create-checkout geändert, Migration dabei. Kann das raus?" | `deploy-choreografie` | ✓ |
| „Benenne `spanne` in `preisSpanne` um." | KEINER | ✓ |
| „Weißer Text auf Foto, Knopf 36 px. Ist das fertig?" | `zera-audit` | ✓ |
| „Was bedeutet ECONNREFUSED allgemein?" | KEINER | ✓ |

Der Auftrag verlangt: *mit Skill schlägt ohne Skill **deutlich***. Mit +0,5 tut
`pawn-kontext` das nicht. Er fällt aber auch nicht unter „kein Unterschied", was
sofortiges Löschen bedeutet hätte.

**Warum die Messung schwach ist:** Der Lauf ohne Skill durfte das Repo lesen und
hat sich das Wissen erarbeitet — er fand sogar Dinge, die der Skill nicht nennt
(`DEFAULT_PLAN_QUOTAS.atelier.videos = 15` fest im Code, das `ON CONFLICT DO
NOTHING` in der Kassenmigration). Gemessen wurde also **Richtigkeit**, nicht
**Kosten der Wiederentdeckung**. Und selbst dort war der Skill nicht billiger:
58.813 Tokens mit gegen 57.219 ohne.

**Zu entscheiden am 2026-09-14:** Hat `pawn-kontext` in vier Wochen nachweislich
etwas gefangen? Wenn nein, fliegt er raus — sein Inhalt liegt gesichert in
`.claude/archiv/CLAUDE.md.vor-turm-v2`, und die nicht ableitbaren Teile stehen
ohnehin in `CLAUDE.md` und `.claude/rules/edge-functions.md`.

---

## 2026-09-08 · Die Rücknahme des Magazins

Daouda hat den gesamten Magazin-Umbau zurückgenommen — nicht wegen eines
einzelnen Mangels, sondern als Produktentscheidung. Zurückgesetzt wurde `src/`
auf `4b7073d`, den letzten Stand vor `5d7e9da` („Teil M1 — der Wendel").

**Was die Rücknahme über den Harness sagt.** Vier Wochen Arbeit an einer Form,
die am Ende ganz verworfen wurde. Kein Test, keine Kontrolle und kein Prüfstand
hätte das verhindert — sie messen, ob das Gebaute hält, nicht ob es gewollt ist.
Das ist keine Lücke im Harness, sondern seine Grenze. Die Lehre gehört nicht in
`regressionen.json`, sondern in den `kreuzverhoer`-Skill: ein Umbau dieser Größe
gehört vor dem ersten Commit auf den Tisch, nicht nach dem dreißigsten.

**Was der Harness dabei gefangen hat** — und das ist die Zahl, die zählt:

| Fund | Wer hat ihn gefunden |
|---|---|
| `/wie-pawn-ki-nutzt` war ein toter Link aus der Datenschutzerklärung — die Seite gab es, die Route nicht | `src/__tests__/routen.spec.ts` |
| Der Korb hielt keine echten Stücke: „In den Korb" bestätigte, der Korb blieb leer | beim Umbau gefunden (`7f90b64`), bei der Rücknahme durch `korb.ts` gehalten |
| Prüfstand und `sicht.sh` zeigten auf gelöschte Heft-Adressen | beim Zurücksetzen aufgefallen, sofort umgehängt |

Beide Frontend-Funde stammen aus der Magazin-Zeit und sind **nicht** mit
zurückgenommen worden. Der zweite ist jetzt als Zusage **Z7** festgenagelt und
einmal rot vorgeführt.

**Nachfunde durch den Menschen bei dieser Runde: 0** (die Rücknahme selbst ist
kein Nachfund, sondern ein Richtungswechsel).

### Z7 — die Vorführung in Rot, als Mitschnitt

Das Gesetz verlangt, dass eine neue Kontrolle **einmal rot vorgeführt** wird,
sonst ist sie behauptet und nicht bewiesen. Der Prüfer hat zu Recht angemerkt,
dass die Vorführung selbst nirgends im Repo lag. Hier ist sie.

Herbeigeführt, indem der Aufruf `inDenKorb({…}, size)` in
`src/pages/ProductDetail.tsx` testweise wieder durch `cart.add(product, size)`
ersetzt wurde — also genau der Rückfall, den die Zusage verbietet:

```
  ✓ Z6 · Der Preisfilter steht beim Oeffnen auf der vollen Spanne …
  ✗ Z7 · Wer auf „In den Korb" tippt, findet das Stueck auch im Korb …
      src/pages/ProductDetail.tsx:270: nimmt wieder cart.add( — die Zeile landet im Korb ohne das Stueck
      Beleg: 7f3155e-Nachfolge: der Bestand aus src/core/seed/products.ts ist mit
      Absicht leer, deshalb fiel jede Korbzeile fuer ein echtes Datenbank-Stueck
      beim Anzeigen heraus (src/store/cart.tsx, productById.get).
REGRESSION: 6/7 · FEHLER: Z7
```

Nach dem Zurücknehmen des Rückfalls: `REGRESSION: 7/7 · FEHLER: keine`.

### Was der Prüfer an diesem Bericht widerlegt hat

Behauptung 4e lautete „an ~19 Stellen ist der Tastatur-Rahmen zurück". Gemessen
waren es **14**. Die 19 stammten aus der Commit-Nachricht von `b517fa1` und
waren abgeschrieben, nicht nachgezählt — genau die Sorte Zahl, die ein Bericht
ungeprüft weiterträgt.

Beim Nachzählen kam heraus, dass die Differenz kein Rundungsfehler war, sondern
ein **echter Verlust**: `b517fa1` hatte auch in `src/pages/Index.tsx` (1×) und
`src/pages/ProductDetail.tsx` (2×) den Fokus-Rahmen zurückgegeben. Beide Dateien
wurden bei der Rücknahme als Ganzes auf `4b7073d` zurückgesetzt — die drei
Reparaturen fielen dabei mit heraus. Sie sind nachgetragen; damit stehen 17
Entfernungen in 14 Dateien, deckungsgleich mit `b517fa1`.
`tools/pruefstand/fokus-waechter.mjs` bestätigt: „keine unbeantwortete
Fokus-Unterdrückung."

**Die Lehre:** der Prüfer hat nicht die Aussage widerlegt, sondern über eine
falsche Zahl einen echten Fehler gefunden. Ein Agent ist niemals sein eigener
Prüfer — hier ist der belegte Fall dazu.

---

## 2026-09-08 · Der falsche grüne Haken

PR #182 wurde um 21:04 gemerged. Der Check war grün. Der Lauf dahinter sagte:

```
Gates: 1 bestanden · 0 gefallen · 1103 nicht prüfbar
```

**Eine von 1104 Kontrollen war gemessen.** Auf dem Runner scheiterte die
Namensauflösung zu Supabase, jede Seite war eine leere Hülle. Die Hüllen-Regel
hat richtig gehandelt — sie wertete nichts. Nur sah „0 gefallen" von einem
gemessenen Gate im Check genauso aus wie „0 gefallen" von 1104.

**Das ist die teuerste Sorte Fehler in diesem Harness.** Der ganze Turm ist
gegen falsches Grün gebaut: die Hüllen-Regel, das Zählen der NEUEN Aufnahmen in
`sicht.sh`, die Ausnahmen mit Wecker. Alle fangen ihren Fall. Keiner fing
diesen, weil das Urteil am Ende nur noch eine Zahl ansah — die gefallenen — und
nie fragte, wie viele überhaupt betrachtet wurden.

Behoben mit `tools/pruefstand/urteil.ts`: unterschreitet der messbare Anteil
`MINDESTANTEIL_MESSBAR`, hat der Lauf **kein Urteil** und endet mit 1. Wache in
`src/__tests__/kein-urteil.spec.ts`, geschrieben auf den echten Zahlen der Läufe
91 und 92. Einmal rot vorgeführt, indem die Schwelle auf 0,0005 gesenkt wurde —
also genau so weit, dass Lauf 92 wieder durchginge:

```
× Lauf 92 — der falsche grüne Haken, an dem das hier hängt
× Lauf 91 war genauso blind — nur zufällig rot
✓ (die übrigen fünf)
Tests  2 failed | 5 passed (7)
```

### Nachfunde durch den Menschen: 0. Nachfunde durch die Maschine: 3.

| Fund | Wer |
|---|---|
| Drei Fokus-Rahmen fielen beim Zurücksetzen mit heraus | Subagent `pruefer`, über eine falsche Zahl im Bericht |
| Kontrolle 4.5 war seit Wochen ein falsches Rot — acht verworfene Fassungen, die letzte war richtig | Prüfstand-Lauf 91, plus der nie ausgeführte Test aus dem eigenen README |
| Ein Lauf, der nichts gemessen hat, meldete grün | Prüfstand-Lauf 92 — gegen sich selbst |

**Die Lehre aus allen dreien ist dieselbe:** jeder Fund kam daher, dass eine
Zahl nicht zur Behauptung passte, und jemand nachgerechnet hat statt zu nicken.
Zweimal war das Messgerät kaputt, nicht der Code. Ein Harness misst am Ende
nicht nur das Produkt — er muss sich selbst messen.

---

## 2026-09-08 · Der Ausfall — und der Skill, der ihn in einer Zeile benannte

Daouda meldet: keine Häuser, Google-Anmeldung tot. Die verwaltete
Supabase-Instanz antwortet nicht.

**Der Skill `pawn-kontext` hat das in seiner ersten Zeile beantwortet**, noch vor
jeder Suche:

> Löst der Datenbank-Name nicht auf, prüfe zuerst das Lovable-Guthaben. Das ist
> fast nie ein Netzproblem und fast immer ein aufgebrauchtes Guthaben — die
> verwaltete Instanz wird dann pausiert.

Ohne diese Zeile wäre die naheliegende Vermutung DNS, Vercel oder — am
teuersten — die Rücknahme gewesen, die vier Stunden vorher gemerged wurde. Der
Skill hat den Suchraum sofort auf die richtige Stelle verengt.

**Das gehört in die Entscheidung am 2026-09-14.** `pawn-kontext` hat die
Eval-Latte nicht genommen (+0,5 statt deutlich) und stand zur Löschung an. Hier
ist der belegte Fall, den die Eval nicht messen konnte: sie maß *Richtigkeit*
bei ruhiger Recherche, nicht *Zeit bis zur richtigen Vermutung im Ausfall*. Das
ist der Unterschied zwischen einem Nachschlagewerk und einem Notfallblatt.

Belege für den Ausfall, dreifach:

| Beleg | Ergebnis |
|---|---|
| GitHub-Runner, Läufe 91 und 92 | `net::ERR_NAME_NOT_RESOLVED` auf `rnakubexbqfgfciynqpt.supabase.co` |
| `select 1` über die Lovable-API | `499 request_cancelled` — auch die einfachste Abfrage hängt |
| Daouda auf pawn.vision | keine Häuser, keine Anmeldung |

Und der Gegenbeweis, dass es nicht die Rücknahme war: `src/integrations/supabase/`
wurde in der gesamten Magazin-Zeit nie angefasst, das ausgelieferte Bündel zeigt
auf dieselbe Projektkennung, und beide gescheiterten Läufe liegen **vor** dem
Merge um 21:04.

### Der Beweis ohne Browser — und die Regel, die im echten Lauf griff

Lauf 94 (08.09., 21:23) hat beides geliefert.

**Erstens, die neue Regel bei der Arbeit.** Genau der Fall, der zwei Stunden
vorher noch als grüner Haken durchging:

```
Gates: 1 bestanden · 0 gefallen · 1106 nicht prüfbar

KEIN URTEIL — nur 1 von 1107 Gates messbar (0.1 %, gefordert 50 %).
Dieser Lauf sagt nichts über den Zweig — weder Gutes noch Schlechtes.
##[error]Process completed with exit code 1.
```

Vom Vorführen im Test zum Greifen im echten Lauf, am selben Abend.

**Zweitens, der Ausfall ohne jeden Zweifel.** Der Schritt „Datenhost auflösen"
in `pruefstand.yml` misst auf Betriebssystem-Ebene, ohne Browser — er lief mit
`continue-on-error`, seine Ausgabe zählt, nicht sein Haken:

```
— getent —
keine Auflösung
— HTTP —
000
kein Verbindungsaufbau
```

**Der DNS-Name existiert nicht mehr.** Kein Browserproblem, kein Proxy, kein
Container, keine langsame Datenbank — der Name ist aus dem DNS verschwunden.
Genau das passiert, wenn eine verwaltete Instanz pausiert wird.

Dieser Diagnose-Schritt stammt aus einer früheren Sitzung und hatte bis heute
nie etwas gefangen. Heute hat er den Unterschied zwischen „irgendwas mit dem
Netz" und „der Name ist weg" gemacht — in zwei Zeilen. **Das ist der Beleg für
den Wert einer Komponente, den das Ausmisten alle vier Wochen sucht.**
