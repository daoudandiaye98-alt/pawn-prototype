# PAWN — gemeinsame Produktentscheidungen

Stand: 12. September 2026. Grundlage: Daoudas Entscheidungen im PAWN-Task.
Diese Datei ist die gemeinsame Referenz fuer Codex, Claude und Obsidian.
Technischer Fortschritt steht in .claude/stand.json; tatsaechliche Merges stehen in Git.

## Festgelegt

- Ein einziges Magazin traegt die gesamte oeffentliche Welt im unendlichen weissen Raum.
- Der Einstieg zeigt das Cover mit „your move“, oeffnet das Heft und entfaltet den Hero.
- Mode, Interior und Kunst: liegendes Magazin, blaettern durch inszenierte Displays.
- Produktdetails fuehren zum Haus. Haus, DNA, Vision, Suche und Konto richten das Heft auf.
- Die Aufsteller sind freigestellte 2D-Bilder mit echter Silhouette. Kein weisses Rechteck,
  kein Gruenfilter fuer echte Kleidung, keine zwingenden 3D-Produktmodelle.
- Die Designer gestalten ihre eigene Doppelseite und ihr Display innerhalb gemeinsamer Grenzen.
- Frag PAWN, Stilberatung/DNA, Suche und Kundenkonto bleiben tragende Funktionen.
- Backend und Zahlungslogik werden fuer die Gestaltung nicht neu erfunden.
- Das bestehende Heftdesign wird bei Ladezeit- und Prozessverbesserungen erhalten.

## Offene Entscheidungen

- Freistellqualitaet: 20 echte, autorisierte Produktfotos pruefen, inklusive Spitze,
  transparenter Stoffe, dunkler Kleidung und feiner Traeger. Erst dann einen automatischen
  Dienst produktiv einsetzen. Originale bleiben erhalten, Ergebnisse werden wiederverwendet.
- Individuelle Hausgestaltung: zulaessige Hintergruende, Schriftpaare, Ebenen und
  Positionen mit Claude ausarbeiten; freie Gestaltung darf Bedienung nicht verdecken.
- Rechenleistung erst fuer eine gemessene Aufgabe zukaufen. Der lokale A4-PC dient
  auch als Testgeraet fuer schwache Hardware.

## Arbeitsuebergabe

1. Mit `npm run stand` aktuellen Branch, Commit und Abstand zum Hauptzweig ablesen.
2. .claude/stand.json lesen; Angaben dort sind Berichte mit Datum, keine Live-Messung.
3. Vor parallelen Aenderungen Arbeitskopie und betroffene Dateien benennen.
4. Nach der Arbeit festhalten: gebaut, geprueft, noch nicht live, naechster Schritt.
5. Keine Geheimnisse oder Kundendaten in Obsidian-Uebergaben kopieren.

Obsidian zeigt diese Entscheidungen und einen erzeugten Git-Schnappschuss. Es ersetzt
nicht Git, Supabase oder den Pruefbericht. Eine widersprechende alte Notiz wird berichtigt,
nicht als zusaetzliche Regel weitergefuehrt.
