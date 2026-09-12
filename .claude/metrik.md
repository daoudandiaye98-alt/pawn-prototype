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
| 2026-09-08 | #182 | 1 | Der Prüfer fand beim Zurücknehmen des Magazins drei verlorene Fokus-Rahmen. | Z7 |
| 2026-09-10 | #184 | 0 (offen) | Teil H — das Heft zieht ein. Sechs Fehler wurden vor dem Merge gefunden, alle beim Ansehen im Browser mit Datenbank-Zeilen, keiner im Quelltext. Drei alte Zusagen sind mit ihren Seiten umgezogen, drei neue kamen dazu. | Z5/Z6/Z7 umgezogen · Z8–Z10 neu, je rot vorgeführt |
| 2026-09-11 | #184/#190 | **3** | Daouda hat auf der laufenden Seite drei Mängel gefunden: F1 beim Laden blitzt links ein unformatierter Textblock auf · F2 die Blätteranimation blättert eine weiße Seite · F3 „Unsere Häuser" → Welt auswählen → die Anwendung hängt. Alle drei im Browser gesehen, keiner im Quelltext, keiner von einer Kontrolle gefangen. | Z14 (F3) und Z15 (F1), je rot vorgeführt · F2 ohne Zusage: im Container nicht nachstellbar |

## Was Teil H über die Kennzahl sagt

Die sechs Fehler dieses Zweigs sind **keine** Nachfunde: gefunden hat sie der Agent,
vor dem Merge, mit `referenz/probe-echt.html` in einem echten Browser. Genau das ist,
was Gesetz 4 („gib dem Agenten Augen") erreichen sollte — und es hat gewirkt, weil
`fixtures/zeilen.mjs` Zeilen in der **Form** der echten Tabellen liefert. Vier der sechs
Fehler (`undefined` in der Suche, das Haus ohne Theme, der Absturz auf „Für Designer",
die synchrone Bildadresse) waren im Quelltext unsichtbar und in den Beispieldaten
ebenfalls — sie zeigen sich nur, wenn eine Produkt-Id eine UUID ist und kein Wort.

Die Lehre für die nächste Schicht: **Beispieldaten, die zu freundlich sind, verstecken
Fehler.** Eine Fixture, die aussieht wie die Datenbank, ist mehr wert als hundert Zeilen
Prosa über die Datenbank.

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

## 2026-09-11 · Drei Nachfunde, und was sie über die Kontrollen sagen

Die Zahl springt von 0 auf **3**. Das ist keine Verschlechterung des Harness,
sondern das erste Mal, dass ein Mensch die Seite nach einem großen Merge
gründlich angesehen hat. Alle drei Mängel sind **nur am Bild** zu sehen:

| Fund | Warum keine Kontrolle ihn gefangen hat |
|---|---|
| F1 · unformatiertes Aufblitzen | Ein Zustand von wenigen Millisekunden zwischen „DOM da" und „CSS da". Kein Test sieht ihn, `sicht.sh` fotografiert erst die fertige Seite. |
| F2 · weiße Seite beim Blättern | Braucht eine aufgeschlagene Doppelseite. Im Container existiert nach 40 Scroll-Schritten kein `.spread` im DOM — das Blatt lässt sich hier nicht umblättern. |
| F3 · Häuser → Welt → hängt | Brauchte eine **leere** Datenbank. Die Beispieldaten haben in jeder Welt ein Haus, also war `haeuserDerWelt[0]` dort immer da. Die Fixture war zu freundlich — dieselbe Lehre wie bei Teil H, eine Ebene tiefer. |

F3 ist jetzt mechanisch gedeckt: `anschluss.test.mjs` rendert **jede** Doppelseite
**jeder** Sektion mit leeren Daten. Das ist die Kontrolle, die gefehlt hat.

### Was die rote Vorführung diesmal gefangen hat

Beide neuen Kontrollen waren in ihrer **ersten** Fassung zu weich, und beide
Male hat erst der rote Lauf es gezeigt:

- **Z14** schloss jede Zeile mit einem Fragezeichen aus — und ließ damit genau
  Daoudas Fehler durch. Ich brach den Wächter in `views.mjs`, die Kontrolle blieb
  grün. Sie sucht jetzt den **Wächter**, nicht das Fehlen des Zugriffs.
- **Z15** ließ ein beliebiges `setTimeout` irgendwo in der Datei als Obergrenze
  gelten. Ich nahm die Obergrenze heraus, die Kontrolle blieb grün. Sie sucht
  jetzt im Rumpf von `blattGeladen`.

Das ist der ganze Zweck des Rituals: *eine Prüfung, die nicht rot vorgeführt
wurde, ist behauptet und nicht bewiesen.* Hier sind zwei belegte Fälle.

---

## 2026-09-11 · Der Prüfstand war blind, und zwar durch eigenen Code

Die härteste Lehre dieser Sitzung, und sie gehört hierher statt in `regressionen.json`,
weil sie das Messwerkzeug selbst betrifft.

Seit Teil L13 klopft das Heft an `/auth/v1/health`, um zu entscheiden, ob die
Datenbank lebt — mit einer Frist und einem `AbortController`. Der Hüllen-Wächter des
Prüfstands zählt jede fehlgeschlagene Anfrage an den Datenhost als „die Seite hat ihre
Daten nicht bekommen" und setzt **alle** Befunde dieser Seite auf `nicht prüfbar`. Ein
Abbruch, den das Heft selbst auslöst, sieht für ihn genauso aus.

Ergebnis, gemessen an zwei Läufen auf demselben Zweig:

| | #150 (`33ad2df`) | #151 (`eafefdd`) |
|---|---|---|
| bestanden | 1 | 649 |
| gefallen | 0 | 119 |
| nicht prüfbar | 1051 | 288 |
| Urteil | KEIN URTEIL (0,1 % messbar) | gemessen |

**Von 1 messbaren Gate auf 768.** Dazwischen liegen vier Zeilen.

Das Werkzeug hat also nicht falsch gerechnet — es hat sich selbst entwertet, und zwar
leise: der Check blieb grün, die Warnung „KEIN URTEIL" stand im Protokoll, und niemand
hat sie gelesen. Seit `#185` sagt der Lauf wenigstens, dass er nichts weiß. Ohne `#185`
wäre es eine dauerhaft grüne Lüge gewesen.

**Die Lehre, und sie ist neu:** Gesetz 4 sagt „gib dem Agenten Augen". Es sagt nicht,
was zu tun ist, wenn die Augen *zugehen*, ohne dass es jemand merkt. Ein Messwerkzeug
braucht eine Messung über sich selbst — und die hat `#185` gebaut („unter N gemessenen
Gates ist der Lauf kein Urteil"). Diese Schwelle ist das Einzige, was den Fehler
überhaupt sichtbar gemacht hat. **Sie hat sich an genau einem Fall bezahlt, und zwar an
diesem.** Beim nächsten Ausmisten ist das die Antwort auf die Frage „wann hat sie
zuletzt etwas gefangen?"

**Nachfunde durch einen Menschen: unverändert 3.** Dieser Fund ging auf das Konto des
Werkzeugs, nicht auf das eines Menschen — aber er erklärt, warum Daouda drei Mängel
finden musste, die kein Lauf gefangen hat. Vier Wochen lang hat nichts gemessen.

---

## 12.09.2026 · die Kette, und was in ihr steckte

| | |
|---|---|
| Migrationen gespielt | 169 Versionen aus 170 Dateien, gegen `cnxtdcifkrdxvajaikxq` |
| Abnahme | md5 über alle Versionen, beidseitig `9bcdb726…` · 177 Objekte gemessen da |
| Dateien, die **in sich** kaputt waren | 2 |
| Dateien, die etwas doppelt oder zu früh anlegen | 7 |
| **Nachfunde durch einen Menschen** | **unverändert 3** |

**Sieben Brüche in einer Kette, die seit Monaten als „die Wahrheit" galt.** Keiner davon
war durch Lesen zu finden — jeder einzelne hat sich erst gezeigt, als die Datei wirklich
an eine Datenbank ging. Zwei Dateien waren *in sich* nicht spielbar: eine Policy, die
etwas liest, das dieselbe Datei erst weiter unten anlegt. Fünf weitere legen an, was eine
andere Migration schon anlegt, oder benutzen eine Spalte, die erst später entsteht.

Der gemeinsame Grund ist keiner von sieben Zufällen: **der Lovable-Agent hat Dateien
gebündelt auf eine Datenbank angewandt, die dem Repo voraus war.** Damit hat der Ordner
nie dasselbe beschrieben wie die Datenbank — und es war niemandem anzusehen, weil
niemand die Kette je von null gespielt hat.

**Die Lehre, und sie ist die teuerste dieses Monats:** eine Migration, die nie von null
gelaufen ist, ist keine Migration. Sie ist eine Notiz darüber, was einmal jemand
angewandt hat. Der Unterschied bleibt unsichtbar, solange niemand bei null anfängt —
und wird in dem Moment total, in dem jemand muss.

**Und eine zweite, die dieselbe Form hat:** der erste M7-Durchgang hat 16
anon-aufrufbare SECURITY-DEFINER-Funktionen gefunden und auf 0 gebracht — gemessen, auf
einer Datenbank mit 35 Migrationen. Nach der vollständigen Kette waren es wieder 15.
Beide Messungen waren richtig. Beide Berichte waren richtig. Und trotzdem war das Loch
offen, darunter `assign_invoice_number`, die Rechnungsnummern verbrennt. **Eine Messung
gilt nur für den Stand, auf dem sie gemacht wurde — ein Bericht, der das nicht sagt,
behauptet mehr als er weiß.** Deshalb hängt die neue Prüfung `Z18` an den *Dateien*.

---

## 12.09.2026 · die Maske, die niemand benutzte

| | |
|---|---|
| Zweig | `claude/teil-m` |
| Erledigt | M4 (Z20), L3 (Z10 erweitert) |
| Neue Prüfungen | 1 neue Zusage, 1 erweiterte — alle drei neuen Hälften einmal rot vorgeführt |
| **Nachfunde durch einen Menschen** | **unverändert 3** |

**Eine Spaltenmaske, die seit dem Erstaufbau auf der Datenbank lag und nicht benutzt
wurde.** `heft_haeuser` und `heft_produkte` existieren, `security_invoker = true`, `anon`
hat `SELECT` darauf — und in `HeftRoute03.tsx` stand `sichten: false`, mit dem Kommentar
„die Sichten gibt es erst nach der Migration". Der Kommentar war einmal wahr. Danach hat
ihn niemand gegen die Wirklichkeit gehalten.

**Die Lehre:** eine Begründung mit Verfallsdatum im Code ist eine Zeitbombe mit
umgekehrtem Vorzeichen — sie tickt nicht, sie *schläft*. Solange sie dasteht, liest jeder
sie als Grund, nicht als offenen Punkt. Deshalb prüft `Z10` jetzt nicht mehr nur, ob die
Maske richtig gebaut ist, sondern ob sie **benutzt** wird. Das ist der dritte Ort, und es
war der stille.

**Und der Fund, der dabei herausfiel:** die Sicht schützt nur, wovon gelesen wird. `anon`
darf `public.designers` weiter direkt fragen und bekommt dort **33 Spalten**, die die
Sicht verbirgt — `stripe_account_id`, `stripe_customer_id`, `stripe_subscription_id`,
`user_id`, `revenue_share_pct` darunter. Eine Policy begrenzt Zeilen, kein Recht begrenzt
Spalten. Das ist der zweite Teil von M3, und er wartet auf Daoudas Wort, weil ein falscher
Schnitt die Live-Seite in derselben Sekunde bricht.
