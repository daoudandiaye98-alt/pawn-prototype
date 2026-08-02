## Entscheidung vorab

**Ein Pfad, nicht drei.** Drei getrennte Seiten würden dreifachen Pflegeaufwand, dreifache Texte und drei Einstiegspunkte bedeuten — und PAWN gerade das nehmen, was es besonders macht: dass Mode, Interior und Kunst unter einem Dach stehen. Effektiver ist **eine Seite mit einer Weiche**: Der Bewerber wählt gleich zu Beginn seine Disziplin, danach spricht die Seite in seiner Sprache (Beispiele, Bilder, Felder, Formulierungen). Ein Ort, drei Handschriften.

## 1. Die Bewerbungsseite (`/apply`)

Aufbau von oben nach unten, streng schwarz/weiß, Playfair + Inter, harte Kanten:

1. **Kopf** — „Werde ein Haus." bleibt (stark, markentypisch), darunter eine neue Unterzeile, die alle drei anspricht: Kleidung, Räume, Werke.
2. **Neu: Disziplin-Weiche** — drei große Karten direkt unter dem Kopf: *Mode · Interior · Kunst*. Klick setzt die Disziplin (bleibt in der URL, z. B. `/apply?welt=mode`) und **verändert die restliche Seite**: die fünf Leistungs-Akte bekommen je Disziplin passende Beispiele und Formulierungen (Video-Kampagne bei Mode = Lookbook-Clip, bei Interior = Raum-Szene, bei Kunst = Werkbetrachtung). Wer nichts wählt, sieht eine neutrale Fassung — niemand wird ausgeschlossen.
3. **Was du bekommst** (die heutigen fünf Akte, Texte überarbeitet und auf den heutigen Stand gebracht): eigene Hausseite, kuratiertes Publikum, Kampagnen-Studio inkl. KI-Video und Produktfotos, direkte Auszahlung über Stripe (93 % zu dir, 7 % Plattform), Einblicke/Kennzahlen. Die alte Formulierung „Wir beteiligen uns prozentual" wird durch die echte, heutige Regelung ersetzt.
4. **Was wir suchen / was wir nicht suchen** — neuer, kurzer Block. Ehrliche Kriterien schrecken die Falschen ab und ziehen die Richtigen an; senkt die Prüfarbeit.
5. **Ablauf** — vier Schritte, aber mit echten Angaben: Bewerbung ≈ 10 Minuten, Antwort in 7 Tagen, Onboarding, erster Auftritt.
6. **Häufige Fragen** — ausklappbar, sechs bis acht Fragen (Kosten, Mindestanzahl Stücke, Versand, Steuer/Umsatzsteuer, Rechte an Bildern, Kündigung).
7. **Abschluss-CTA** — „Bewerbung starten" führt die gewählte Disziplin ins Formular mit.

Alle Texte laufen weiter über `Editable`/`site_content`, damit du sie ohne Code ändern kannst — inklusive der neuen Blöcke.

## 2. Der Bewerbungspfad (`/apply/form`)

Heute: fünf gleich aussehende Formularschritte in Standard-Optik, die nicht zur Site passt und nicht führt. Neu:

- **Optik angleichen**: gleiche Designsprache wie Studio/Admin (harte Kanten, Serifen-Überschriften, Fortschrittslinie statt Standard-Stepper), mobil zuerst.
- **Führung statt Formular**: pro Schritt eine kurze Erklärzeile in einfacher Sprache („Warum wir das fragen"), sichtbarer Fortschritt („Schritt 2 von 5 · noch ca. 6 Minuten").
- **Schritt-Reihenfolge neu**: 
  1. *Deine Disziplin* (vorbelegt aus der Landing) 
  2. *Dein Haus* (Name, Ort, Land) 
  3. *Deine Arbeit* — **hier greift die Weiche**: Mode fragt nach Kollektion/Fertigung/Größen, Interior nach Material/Maßanfertigung/Lieferung, Kunst nach Technik/Unikat oder Edition/Format. Portfolio-Upload bleibt, mit klarer Vorgabe (3–8 Bilder, was wir sehen wollen).
  4. *Verträge* — unverändert in der Mechanik, nur bessere Darstellung.
  5. *Absenden* — Übersicht in Klartext.
- **Zwischenstand sichern**: Eingaben landen im Browser-Speicher, damit ein Abbruch nichts kostet.
- **Bessere Fehlermeldungen** in einfachem Deutsch, direkt am Feld statt nur als Toast.
- **Erfolgsseite** mit klarer Erwartung: was jetzt passiert, wann Antwort kommt, was du inzwischen vorbereiten kannst.

## 3. Sprache

Alle Texte auf beiden Seiten werden überarbeitet: kein Jargon, keine veralteten Versprechen (Credits, „Sichtbarkeitspakete"), aktuelle Fakten (Stripe-Auszahlung, Pläne Haus/Atelier/Maison, KI-Studio). Englische Reste im Formular („Apply once. Be seen forever.", „Back to designers") verschwinden — die Seite läuft über den vorhandenen Sprach-Umschalter.

## Technische Details

- `src/pages/ApplyLanding.tsx`: Disziplin-Zustand über Query-Parameter `welt`, Inhalte aus einer neuen Datei `src/features/apply/disciplines.ts` (ein Objekt je Welt: Beispiele, Feldbezeichnungen, Fragen). Neue Abschnitte als kleine Komponenten unter `src/features/apply/`.
- `src/pages/Apply.tsx` wird in Schritt-Komponenten zerlegt (`src/features/apply/steps/*`), Zod-Schemas bleiben, kommen ein disziplinabhängiges Zusatzschema dazu.
- Speicherung der Disziplin: `designer_applications` hat heute keine passende Spalte. Vorschlag: eine Spalte `world text` per Migration ergänzen (nur Hinzufügen, keine Änderung bestehender Regeln/Policies) und im Edge-Function-Aufruf `submit-application` mitschicken. Falls du keine Migration willst, schreiben wir die Disziplin ersatzweise als ersten Eintrag in `tags` — dann ist kein Backend-Eingriff nötig.
- Edge Function `submit-application` müsste im Migrationsfall ein Feld mehr durchreichen — **das kostet einen Lovable-Deploy**. Ohne Migration (Tag-Variante) bleibt alles reine Frontend-Arbeit über Git und damit kostenlos.
- Kein neues Farbschema, keine neuen Abhängigkeiten. Typecheck grün vor Abschluss, Prüfung bei 390 px und iPad.

## Offene Entscheidung

Disziplin als **eigene Spalte** (sauber, kostet einen Function-Deploy) oder vorerst als **erster Tag** (kostenlos, minimal unsauber)? Wenn du nichts sagst, baue ich die Tag-Variante und markiere die Spalte als späteren Schritt.
