---
name: kreuzverhoer
description: Nimmt einen Plan auseinander, BEVOR gebaut wird — stärkste Annahme, schwächste Annahme, was übersehen wurde, welche Reihenfolge kippt, was passiert, wenn Schritt 3 fehlschlägt. IMMER anwenden, bevor du mit einem mehrteiligen Bau anfängst, auch wenn der Plan überzeugend klingt und besonders dann, wenn du selbst ihn geschrieben hast. Trigger: „bau mir", „lass uns X umsetzen", „hier ist mein Plan", „Teil N", „PART N", „das nächste Feature", „Migration", „Umbau", „refactor", „bevor wir anfangen", „was hältst du davon" — sowie jedes Mal, wenn ein Vorhaben mehr als drei Dateien oder mehr als einen Schritt berührt. Der Planmodus allein rutscht zu schnell in die Umsetzung; dieser Skill hält ihn fest. Gegenstück zum Subagenten `pruefer`: Kreuzverhör prüft vorher, der Prüfer prüft nachher.
---

# Kreuzverhör

Ein Plan wird nicht besprochen, er wird verhört. Ziel ist nicht, ihn zu
verwerfen — Ziel ist, den Punkt zu finden, an dem er in der Wirklichkeit
zerbricht, **bevor** dort Code steht.

## Die Regel darüber

Ein Kreuzverhör, das den Plan gut findet, war keins. Wer nach fünf Fragen nichts
gefunden hat, hat zu freundlich gefragt. Es gibt immer eine Annahme, die niemand
geprüft hat.

## Die sieben Fragen

**1 · Was ist die stärkste Annahme?**
Die eine, auf der alles steht. Nenne sie in einem Satz. Wenn sie fällt, fällt der
ganze Plan — also: woher weißt du, dass sie stimmt? Datei und Zeile, Befehl und
Ausgabe, oder „geraten".

**2 · Was ist die schwächste Annahme?**
Die, bei der du dich am unwohlsten fühlst. Genau die wird gerne stillschweigend
übersprungen. Schreib sie hin.

**3 · Was wurde übersehen?**
Drei Kandidaten, die in diesem Projekt fast immer fehlen:
- die englische Seite (`src/lib/i18n.tsx` — jeder neue deutsche Schlüssel braucht
  seine Entsprechung, sonst ist es ein **Typfehler**)
- der leere Zustand und der Fehlerzustand
- 390 px

**4 · Welche Reihenfolge kippt?**
Was muss zwingend vor was? In diesem Repo gibt es eine Reihenfolge, die immer
kippt: **Migration vor Code.** Geht der Code zuerst live, antworten neue Uploads
mit 400 auf einen noch privaten Eimer. Beleg: `61e0204`. Siehe Skill
`deploy-choreografie`.

**5 · Was passiert, wenn Schritt 3 fehlschlägt?**
Nicht Schritt 1 — der wird ohnehin geprüft. Die Mitte ist die Stelle, an der ein
halb ausgeführter Plan liegen bleibt. Gibt es einen Weg zurück? Oder steht die
Datenbank dann in einem Zustand, den kein Code mehr erwartet?

**6 · Was kostet Geld oder ist unumkehrbar?**
Lovable-Guthaben (jeder Edge-Function-Deploy), Stripe (PAWN ist live, echte
Zahlungen), Migrationen (nicht rücknehmbar), gelöschte Daten. Steht davon etwas
im Plan, gehört es in die erste Zeile der Antwort, nicht in die letzte.

**7 · Was davon kann ein Agent gar nicht selbst tun?**
Edge Functions ausliefern, Migrationen ausführen, Secrets setzen, Routinen
anlegen, einen PR mergen. Diese Schritte werden ausdrücklich als **„braucht
Daouda"** markiert — nie stillschweigend eingeplant und dann im Bericht
übersprungen.

## Die Antwortform

Kurz. Keine Einleitung. Sieben Punkte, je zwei bis vier Sätze, dann:

```
GRÖSSTES RISIKO   … (eine Zeile)
ERSTER SCHRITT    … (der Schritt, der das größte Risiko am billigsten prüft)
BRAUCHT DAOUDA    … (oder: nichts)
```

Der erste Schritt ist nie „mit dem Bauen anfangen". Er ist immer der billigste
Versuch, die stärkste Annahme zu widerlegen.

## Was dieser Skill nicht ist

Kein Freibrief für Bedenken. Wer sieben Risiken nennt und keinen ersten Schritt,
hat den Plan nicht verhört, sondern verweigert. Am Ende steht immer ein Zug.
