# Deploy-Paket — eine Liste, eine Reihenfolge

Stand: PR #184 (Zweig `claude/heft-frontend-integration-0bjnzf`, Teil H — „Das Heft zieht ein").

Alles, was in diesem Zweig steckt und **nicht** über Git allein live geht, steht hier in
genau der Reihenfolge, in der es angewandt werden muss. Nichts davon passiert automatisch:
Migrationen und Edge Functions gehen nur über den Lovable-Agenten.

**Die eine Regel für die Reihenfolge:** erst die Datenbank, dann der Merge, dann die
Functions. Eine Function, die auf eine noch nicht existierende Tabelle greift, scheitert
sauber — aber sie scheitert.

**Und davor die Regel aus Teil Y:** Vor dem Merge steht Daoudas Sicht-Freigabe auf der
Vercel-Vorschau. Die Checkliste steht im PR.

---

## Schritt 0 — Ansehen, bevor irgendetwas angewandt wird

Die Vorschau von PR #184 öffnen und durchgehen:

| | Was | Warum genau das |
|---|---|---|
| ☐ | Eröffnung ruhig, ungefähr 5,8 s | Der Container, in dem gebaut wurde, rendert 1 Bild pro Sekunde. Über Bewegung sagt der Bau nichts. |
| ☐ | Echte Häuser auf den Bühnen | Der Bau hat nur Beispielzeilen gesehen. |
| ☐ | Ein Werk anklicken | Die Adresse muss auf `/werk/<slug>` springen, die Zurück-Taste muss das Fenster schließen. |
| ☐ | Tasche → Stripe-Kasse öffnet | Testmodus reicht, kein Kauf. Das ist der Weg, an dem Geld hängt. |
| ☐ | Konsole ohne Fehler | |
| ☐ | 390 px und iPad | |

Findet sich dabei ein Mangel: **Ritual.** Zeile in `.claude/regressionen.json`, Kontrolle
in `scripts/verify/`, einmal rot vorgeführt. Reparieren allein zählt nicht als erledigt.

---

## Schritt 1 — Migrationen, in dieser Reihenfolge

Alle vier sind **additiv**: keine bestehende Spalte wird gelöscht, kein bestehender
Constraint verschärft. Jede Datei trägt im Kopf, aus welcher Quelle unter
`src/heft03/sql/` sie kommt.

| # | Datei | Was sie tut | Reversibel |
|---|---|---|---|
| 1 | `20260928090000_heft_sichten.sql` | Sichten `heft_produkte` und `heft_haeuser` mit `security_invoker`, Spaltenmaske, `grant select` an anon | ja — `drop view` |
| 2 | `20260928100000_heft_kunden_stil.sql` | Tabelle `kunden_stil` (Welt, Richtung, Form, Für-wen, Foto-Befund), RLS auf die eigene Zeile, Touch-Trigger | ja — `drop table` |
| 3 | `20260928110000_heft_masse_raum.sql` | Spalte `customer_measurements.raum jsonb` | ja — `drop column` |
| 4 | `20260928120000_heft_product_dna.sql` | Check-Constraint auf `product_dna.heft` (Höhe zwischen 1,2 und 3,4) | ja — `drop constraint` |

**Warum Nummer 1 nicht warten sollte.** Die Policy `designers public read` steht auf
`USING (published = true)` und hat **keine Spaltenmaske** — jeder Besucher der Seite kann
heute `stripe_account_id` und `stripe_customer_id` der Häuser lesen. Das Heft fragt diese
Spalten nicht ab (Zusage Z10 hält das fest), aber die Lücke selbst schließt erst die Sicht.

**Warum Nummer 2 vor dem Umschalttag da sein muss.** Ohne `kunden_stil` bleibt das
Bilderquiz im Gerät: Wer sich anmeldet, findet seine Linie am nächsten Tag am Telefon
nicht wieder. `user_memory` hilft nicht — es erlaubt Kunden kein INSERT.

## Schritt 2 — `types.ts` neu erzeugen

Erst jetzt möglich, und nötig: die heutige Fassung ist älter als die letzten Migrationen
und kennt weder `kunden_stil` noch `customer_measurements.raum` noch
`designers.kauf_freigeschaltet`.

## Schritt 3 — PR #184 nach `main` mergen

Lovable synct, Vercel spiegelt auf pawn.vision. Ab diesem Moment ist das Heft das
öffentliche Frontend und die 18 Umzüge sind scharf.

## Schritt 4 — `pawn-chat` ausliefern

Der Code liegt im Merge, die laufende Fassung ist noch die alte. Bis zum Deploy:

- zeigen die Karten im Chat auf `/product/<slug>` — das läuft über eine 301 statt direkt,
- kennt der Chat den Heft-Kontext nicht (er weiß nicht, auf welcher Seite jemand steht),
- gibt es `mode: "stilfoto"` nicht, und das Foto in „Deine DNA" bleibt ohne Antwort.

Nichts davon ist kaputt, alles davon ist halb.

---

## Was danach kommt

| Was | Warum es noch nicht hier steht |
|---|---|
| Zweig 2 (`claude/heft03-foto`) | Das Stilfoto auf `/deine-dna/foto` und das Bild in „Frag PAWN" brauchen die ausgelieferte Function aus Schritt 4. |
| **H6 — Freistellen** | Muss **vor dem Umschalttag** fertig sein. Die Regel der Bühne ist hart: aufgestellt wird nur, was freigestellt ist (`product_dna.heft.cutout_url`). Ohne die Freistell-Function und einen einmaligen Lauf über alle veröffentlichten Werke stehen die Bühnen leer — mit einem ehrlichen Leerzustand, aber leer. |

---

## Frühere Pakete

Die Migrationen aus PR #165 (`20260926090000_plan_beispiel_freigabe`,
`20260927090000_rochade_warteschlange`) sind angewandt und stehen nicht mehr in dieser
Liste. Wer sie nachlesen will, findet sie in der Git-Geschichte dieser Datei.
