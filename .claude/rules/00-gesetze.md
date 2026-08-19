# Das Ritual, die Kennzahl, das Ausmisten

## Das Ritual — verbindlich

Jeder Mangel, den ein **Mensch** nach einem Merge findet, löst im selben Zug drei
Schritte aus:

1. **Eine Zeile in `.claude/regressionen.json`** — die gebrochene Zusage,
   maschinenlesbar, mit Beleg (Commit oder Fundstelle).
2. **Eine Kontrolle in `scripts/verify/regressionen.mjs`** (oder in `sicht.sh`,
   wenn nur das Auge sie fängt) — die Prüfung, die ihn künftig fängt. Und sie
   wird **einmal rot vorgeführt**, sonst ist sie nicht bewiesen, nur behauptet.
3. **Nur wenn 1 und 2 nicht reichen:** eine Zeile in `.claude/rules/`.

**Den Fehler ohne 1 und 2 zu reparieren, gilt als nicht erledigt.** Wenn es
brennt, löschst du nicht nur — du baust den Brandschutz.

Eine Zusage ohne Prüfung ist eine Karteileiche. Eine Prüfung, die an
rechtmäßigem Code rot wird, ist schlimmer als keine: sie lehrt, Rot zu
übersehen. Prüfungen werden deshalb so **eng** geschrieben wie die Zusage, die
sie deckt — nie breiter.

## Die Kennzahl

`.claude/metrik.md`: Datum · PR · Nachfunde durch den Menschen.

Das ist die einzige Zahl, die zählt. Sinkt sie über vier Wochen nicht, misst
das System das Falsche — dann liegt die Arbeit in `regressionen.json`, nicht in
mehr Werkzeugen.

## Das Ausmisten — alle vier Wochen, gleichrangig mit dem Bauen

Für jede Komponente des Harness:

- Wann hat sie zuletzt etwas gefangen? **Nie? Raus.**
- Ist sie durch ein besseres Modell überflüssig geworden? **Raus.**
- Sagen zwei Skills dasselbe? **Zusammenlegen.**

Ein Harness, der nur wächst, verrottet. *Weniger ist das Ziel.*

## Was vor jeder Fertigmeldung läuft

1. `scripts/verify/verify.sh schnell` — grün, oder die Runde endet nicht
   (`tor.sh` blockiert).
2. Bei allem, was das Aussehen betrifft: `scripts/verify/sicht.sh`, und die
   Aufnahmen **ansehen**.
3. Der Subagent **`pruefer`** gegen den eigenen Bericht. Ein Agent ist niemals
   sein eigener Prüfer.
