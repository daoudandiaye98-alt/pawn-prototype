# Feinschliff: Produktdetails, Passform, Empfehlungen, DNA

Vier Baustellen, eine Richtung: mehr Substanz pro Stück, ehrliche Zustände, kein Rest von abgeschafften Credits.

## 1. Anlegen mit Raum für Details (Studio)

Die Kurzseite „Neues Stück" bleibt der schnelle Einstieg (Foto → Name → Preis → live), bekommt danach aber direkt einen zweiten Schritt statt eines Sackgassen-Hinweises: **„Stück vervollständigen"** — aufklappbare Abschnitte, die aus den bereits vorhandenen Welt-Profilen (Mode / Interior / Kunst) gespeist werden:

- **Größen & Maßtabelle** — pro Größe (S/M/L oder Ausführung/Format) eigene Zeilen in cm. Weil „M" bei jedem Haus etwas anderes heißt, ist die Tabelle die Wahrheit, nicht das Etikett. Zusätzlich: Feld „getragen vom Model in Größe … / Model ist … cm groß" (ASOS-Standard).
- **Material & Herstellung** — Zusammensetzung in Prozent, Herkunft, Fertigungsart, Gewicht.
- **Pflege** — je Welt andere Symbole/Felder (Waschen vs. Reinigung von Keramik/Holz vs. Konservierung & Licht bei Kunst). Das steckt schon in den Welt-Profilen und wird nur konsequent in den Anlege-Fluss geholt.
- **Die Geschichte des Stücks** — längerer Text, plus optional „Warum es existiert" (ein Satz vom Haus).
- **Versand & Rückgabe** — Bearbeitungszeit, Sonderfall Anfertigung, Rückgabe-Hinweis.

Alle Abschnitte einzeln speicherbar, ein Fortschrittsbalken oben („4 von 7 Angaben"), nichts ist Pflicht außer Preis/Foto. Vollständige Stücke bekommen in der Kollektion ein sichtbares Signal.

## 2. Artikelseite: ausklappbare Abschnitte

Auf der Produktseite ersetzen wir die feste Tabelle durch Akkordeons in PAWN-Optik (harte Kanten, 1.5px Linien): *Maße & Passform · Material · Pflege · Die Geschichte · Versand & Rückgabe*. Leere Abschnitte erscheinen gar nicht — keine leeren Hüllen. Erster Abschnitt standardmäßig offen.

## 3. Passformassistent (Quality of Life)

Kunden hinterlegen im Konto ihre Maße (Brust, Taille, Hüfte, Innenbein, Schulter, Fußlänge; optional Körpergröße und Passform-Vorliebe „eng/gerade/weit"). Auf jeder Artikelseite steht dann direkt an der Größenwahl ein Urteil:

```text
DEINE PASSFORM
M — passt (Brust +4 cm Spielraum)
L — zu weit an der Taille
```

Rein rechnerisch, kein KI-Aufruf: Vergleich der Kundenmaße mit der Maßtabelle des Hauses. Ohne hinterlegte Maße: eine Zeile „Maße hinterlegen und wir sagen dir sofort, was passt." Gilt sinngemäß auch für Interior („passt in deinen Raum?" über hinterlegte Raummaße — Ausbaustufe, zuerst Mode).

## 4. Empfehlungen im Studio ohne Credits

Die Seite verspricht heute eine KI-Credit-Gutschrift, die es nicht mehr gibt. Neu: der Empfehlungslink bleibt, die Belohnung wird an das Kontingent-System angebunden — **ein Monat der nächsthöheren Stufe** bzw. zusätzliche Videos/Shots im laufenden Monat, plus eine sichtbare Liste „Wen du gebracht hast". Text und Zahlen kommen weiter aus der Konfiguration, nichts hart verdrahtet.

## 5. DNA-Seite: ehrlich, dann größer

Heute steht oben sinngemäß „genug gesammelt — fordere einen Bericht an", und beim Anfordern kommt „zu wenig Daten". Ursache: die Überschrift prüft den Schwellenwert nicht, der Server tut es. Fix: der Zustand kommt aus einer Quelle, der Knopf erscheint nur, wenn die Schwelle wirklich erreicht ist — sonst steht dort, was noch fehlt („Noch 3 Blicke, dann kann ich etwas über dich sagen"), mit einem konkreten nächsten Schritt.

Darüber hinaus wird die Seite zu einem echten Profil:
- **Dein Maßband** — die hinterlegten Maße aus Punkt 3, hier sichtbar und änderbar.
- **Was dir passt** — Stücke, die laut Maßtabelle *und* Geschmack zusammenpassen, mit „Warum wir dir das zeigen".
- **Deine Entwicklung** — wie sich dein Geschmack über Zeit verschoben hat (aus den vorhandenen Signalen).
- **Alles bleibt löschbar** — jedes Signal, jedes Maß, jede Notiz.

## Technische Notizen

- Neue Produktfelder gehen soweit möglich in die bestehenden Spalten (`measurements`, `care_symbols`, `material_composition`, `product_dna`, `description`); nur für Versandzeit/Model-Angaben braucht es ggf. eine kleine Erweiterung.
- Kundenmaße: neue Tabelle `customer_measurements` (nur der Kunde selbst darf lesen/schreiben, plus Zugriff für Serverfunktionen) — Maße sind persönliche Daten und gehören nicht ins offene Profil.
- Passform-Logik als reine Funktion in `src/features/fit/`, getestet, ohne KI-Kosten.
- Produktdetail-Akkordeons als eigene Komponente, damit Haus- und Boutique-Seiten sie mitbenutzen können.
- Kein neuer Farbwert, keine Rundungen, keine Fake-Daten in leeren Zuständen.
