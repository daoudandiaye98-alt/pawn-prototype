# Das Zwei-Register-Gesetz (Teil 39 AP6)

PAWN spricht in zwei bewusst getrennten Registern. Verwechseln sie sich, entsteht entweder eine kalte Landing-Seite oder ein Kaufvorgang, der sich wie ein Gedicht liest — beides verunsichert. Dieses Gesetz lebt in Code als `ai_config.voice_law.zwei_register` (additiv neben dem bestehenden `text`-Feld, das weiter die Außenauge-Kritiksprache regelt).

## Bühne — poetisch

Playfair-Serif-Ton. Darf andeuten statt erklären, Bilder statt Aufzählung. Ein Satz darf offen enden.

**Gilt für:** Landing-Hero, Welt-Seiten (Mode/Interior/Kunst), Cover-Momente, redaktionelle Texte, Marken-Erzählung, die "Erste Partie"-Begrüßung.

**Beispiel:** *"Die ersten Häuser ziehen ein."*

## Bedienung — Klartext

Inter-Ton. Ein Satz = eine Handlung oder ein Fakt. Nie Metapher, nie Zweideutigkeit.

**Gilt für:** Formulare, Buttons, Bestätigungen, Einstellungen — jede Fläche mit einem Preis, einer Frist oder einer Unterschrift.

**Beispiel:** *"Kündigung wirkt zum Ende der laufenden Abrechnungsperiode."*

## Die Fehler-Formel

Jede Fehlermeldung hat genau zwei Teile:

1. **Was ist passiert** — ein Satz, ohne Fachbegriff, ohne Code, ohne Stacktrace.
2. **Was die Person jetzt tun kann** — ein Satz mit einem Verb (nochmal versuchen, uns schreiben, Feld prüfen).

Nie Teil 1 ohne Teil 2 — eine Fehlermeldung ohne nächsten Schritt lässt Menschen allein.

**Vorher → Nachher (in diesem PR behoben):**

| Fläche | Vorher | Nachher |
|---|---|---|
| `StudioPayout.tsx` (Rechnungsdaten) | rohe Datenbank-Fehlermeldung (`error.message`) | „Deine Rechnungsdaten konnten nicht gespeichert werden. Prüfe die Felder und versuch es noch einmal." |
| `StudioPayout.tsx` (Steuer-Angaben) | rohe Datenbank-Fehlermeldung | „Die Steuer-Angaben konnten nicht gespeichert werden. Versuch es gleich noch einmal." |
| `StudioPayout.tsx` (Versandkosten) | rohe Datenbank-Fehlermeldung | „Die Versandkosten konnten nicht gespeichert werden. Versuch es gleich noch einmal." |
| `StudioPlan.tsx` (Plan-Wechsel zu Paid) | rohe Fehlermeldung aus dem Checkout-Aufruf | „Der Wechsel zu Paid hat gerade nicht geklappt. Versuch es in ein paar Minuten noch einmal." |
| `StudioPlan.tsx` (Atelier→Paid-Anfrage) | rohe Fehlermeldung | „Deine Anfrage konnte nicht verschickt werden. Versuch es gleich noch einmal oder schreib uns direkt." |

**Bereits konform, keine Änderung nötig:** `Checkout.tsx` folgt der Formel bereits seit Teil 11c ("Die Zahlung konnte nicht gestartet werden. Bitte versuch es gleich noch einmal.").

## Geld- und Vertrags-Zusatz

Auf Geld- und Vertragsflächen gilt **Bedienung immer** — auch innerhalb einer sonst poetischen Bühnen-Umgebung. Die Kaufleiste auf einer Bühnen-Produktseite bleibt Klartext, selbst wenn die Bildergalerie darüber Bühne ist. Beträge, Fristen, Kündigungsfolgen und Widerrufsrechte werden immer ausgeschrieben, nie angedeutet.

## Wo das Gesetz technisch lebt

- `ai_config.voice_law.zwei_register` — maschinenlesbar, von Chat-Personas ladbar.
- `pawn-chat`/`pawn-jarvis` Systemprompts verweisen bei Geld-/Fehler-/Vertragsthemen explizit darauf (siehe Code-Kommentar "Teil 39 AP6").
- Diese Datei — menschenlesbare Referenz für UI-Text-Reviews.

## Wie weiter geprüft wird

Dieser PR hat die auffälligsten Verstöße auf den Geld-Oberflächen behoben (rohe technische Fehlermeldungen). Eine vollständige Zeile-für-Zeile-Prüfung aller Bedienungstexte im gesamten Produkt ist eine fortlaufende Aufgabe, kein einmaliger Abschluss — neue Texte sollten von Anfang an gegen dieses Gesetz geschrieben werden, statt es nachträglich zu reparieren.
