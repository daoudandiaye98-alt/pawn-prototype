# Build your Brand — der Begleiter im Studio

Ein neuer, zentraler Ort im Designer-Studio: eine Schritt-für-Schritt-Begleitung vom ersten Foto bis zum ersten Verkauf — mit Belohnungen, täglichen Impulsen, Content-Fahrplan und Antworten auf Praxisfragen (Gewerbe, Rechnung, Steuer). Bestehende, verstreute Funktionen (Journey-Checkliste, Nächster Zug, Level, Ideen-Begleiter, Markenprofil) werden dort zusammengeführt statt neu gebaut.

## 1. Die Seite `/studio/aufbau` — „Deine Marke aufbauen"

Wird der neue erste Menüpunkt im Studio (Bereich „Verkaufen", direkt unter „Start"). „Ideen-Begleiter" und „Markenprofil" bleiben erreichbar, werden aber aus dem Menü heraus in diese Seite als Kapitel eingehängt.

Aufbau der Seite:

- **Kopf:** Level-Figur (Bauer → Springer → Läufer → Turm → Dame, existiert schon), Fortschrittsbalken „X von Y Schritten", ein Satz Zuspruch, der sich mit dem Fortschritt ändert.
- **Der Weg:** fünf Etappen, jede mit 2–4 Schritten. Jeder Schritt zeigt: was zu tun ist, warum es zählt, welches PAWN-Werkzeug hilft, und einen Knopf, der direkt dorthin führt. Erledigte Schritte werden aus echten Daten erkannt (kein separater Status), offene Schritte sind aufklappbar mit einer kurzen Anleitung.

```text
Etappe 1  Ankommen        Konto · Haus benannt · Welt gewählt
Etappe 2  Zeigen          Erstes Stück · gutes Bild · Details vollständig
Etappe 3  Deine Seite     Porträt & Geschichte · Markenseite veröffentlicht
Etappe 4  Sichtbar werden Erstes Video · erstmals geteilt · Posting-Rhythmus
Etappe 5  Verkaufen       Auszahlungskonto · Preise & Versand · erster Verkauf
```

- **Heute:** ein einziger empfohlener Zug (nutzt die bestehende Nächster-Zug-Logik) plus ein kleiner Tagesimpuls („Heute: ein 15-Sekunden-Video, wie du nähst — ohne Schnitt, mit deiner Stimme").
- **Praxisfragen:** aufklappbare Antworten zu Gewerbe, Kleinunternehmerregelung, Pflichtangaben auf Rechnungen, Umsatzsteuer, Widerruf, Versandpflichten — als allgemeine Orientierung mit klarem Hinweis, dass es keine Rechts- oder Steuerberatung ersetzt. Rückfragen gehen an den Studio-Begleiter.
- **Content-Fahrplan:** ein Wochenplan (was posten, welches Format, welcher Anlass) aus dem Markenprofil des Hauses abgeleitet, mit Kopieren-Knopf je Idee.

## 2. Belohnungen und Momentum (gilt für ganz PAWN)

- **Schritt geschafft:** kurze Einblend-Feier (Schachfigur-Animation, Satz in PAWN-Sprache), einmalig je Schritt.
- **Etappe geschafft:** Vollbild-Moment mit Level-Aufstieg (die bestehende Level-Up-Anzeige wird dafür wiederverwendet und erweitert).
- **Serie:** „Dritter Tag in Folge im Studio" — kleine Marke im Kopf der Seite, ohne Druck, ohne Verlust-Mechanik.
- **Kundenseite:** dieselbe Bausteine dezent für Kund·innen (Maße vollständig, erste Merkliste, erste Bestellung) — als kleine Bestätigung, nicht als Spiel.
- Alles streng schwarz-weiß, harte Kanten, keine Farbe, keine Konfetti-Optik. Belohnung wirkt über Typografie, Bewegung und Sprache.

## 3. Jarvis lernt Markenaufbau

Ein neuer Jarvis-Modus `wissen_markenaufbau`, der wöchentlich läuft:

- recherchiert öffentlich zugängliche Ratgeber-Inhalte zu Markenaufbau, Content-Strategie und Social-Rhythmus für kleine Labels,
- destilliert daraus kurze, umsetzbare Merksätze und legt sie als Wissensbausteine ab (Thema, Kernsatz, Beispiel, Quelle),
- der Studio-Begleiter und der Content-Fahrplan ziehen ihre Antworten aus diesen Bausteinen plus dem Markenprofil des jeweiligen Hauses,
- im Admin-Cockpit (`/admin/jarvis`) sichtbar und kuratierbar: Bausteine freigeben, ändern, löschen.

Es werden nur öffentlich zugängliche Quellen ausgewertet und als Merksatz mit Quellenangabe abgelegt — keine kostenpflichtigen Kursinhalte kopiert.

## 4. Erinnerungen

- Beim Betreten des Studios: eine Zeile „Woran wir zuletzt waren" plus der Tagesimpuls.
- Optional per E-Mail: ein wöchentlicher Impuls („Diese Woche: deine Markenseite fertig machen"), abschaltbar in den Einstellungen. Standard: aus, wird beim ersten Besuch der Aufbau-Seite angeboten.

## Technische Umsetzung

- **Neue Seite:** `src/pages/studio/StudioAufbau.tsx`, Route `/studio/aufbau`, Menüeintrag in `StudioShell.tsx`.
- **Etappen-Logik:** `src/features/studio/useBrandJourney.ts` — baut auf `useDesignerJourney.ts` auf (dessen 8 Schritte werden in die 5 Etappen einsortiert und um Bild-Qualität, Content-Rhythmus, Preise/Versand ergänzt). Ableitung weiterhin ausschließlich aus echten Daten.
- **Belohnungen:** `src/features/rewards/` mit `useReward()` und einer Overlay-Komponente; `LevelUpOverlay.tsx` wird darin aufgegangen. Gesehene Belohnungen je Schritt in `user_memory.preferences.rewards`, damit sie geräteübergreifend nur einmal erscheinen.
- **Datenbank:** neue Tabelle `brand_knowledge` (Thema, Kernsatz, Beispiel, Quelle, freigegeben, Welt) mit RLS: Lesen für angemeldete Designer, Schreiben nur Admin/Service. Wochenimpuls-Einstellung als Feld in `designers`.
- **Edge Functions:** `pawn-jarvis` bekommt den Modus `wissen_markenaufbau` (Cron wöchentlich); `studio-ai` bekommt einen Modus `aufbau`, der Etappenstand + Markenprofil + freigegebene Wissensbausteine als Kontext nutzt und Content-Fahrplan sowie Praxisantworten liefert. Beide brauchen danach einen Lovable-Deploy.
- **Sprache:** durchgehend einfaches Deutsch, keine Fachbegriffe ohne Erklärung; alle festen Texte über `site_content` änderbar.

## Reihenfolge

1. Seite + Etappen-Logik + Menü (rein Frontend, sofort sichtbar)
2. Belohnungs-Schicht Studio, danach Kundenseite
3. Tabelle `brand_knowledge` + Admin-Kuration
4. Jarvis-Modus + `studio-ai`-Modus (Deploy nötig)
5. Erinnerungen (Studio-Zeile, danach optionale Wochenmail)
