## Letzter Feinschliff — 5 Schritte

### 1. Streng Schwarz-Weiß (alle Cremetöne raus)
Die Design-Tokens sind bereits reines Schwarz/Weiß, aber in **30 Dateien** stehen noch fest eingetippte Cremetöne (`#7C7972`, `#EFEDE8`, `#EEE9E0`, `#F1EEE7`, `#8F8B82`, `#55534E`, `#A8A49B`, `#0A0A0C`, `#FEF6E1` …).

Vorgehen:
- Ersatzregel: warme Graustufen → `text-black/60` bzw. `/70` (Fließtext-Abstufung), Cremeflächen → `#FFFFFF` mit 1.5px schwarzer Linie, „fast-schwarz" (`#0A0A0C`) → `#000000`.
- Betroffen u. a.: `Index`, `DesignerPage`, `Checkout`, `Cart`, `DNA`, `Designers`, `DesignersIndex`, `Ausgabe`, `Auth`, `ApplyLanding`, `ProductDetail`, `Impressum`, `Shop`, `Versand`, `AGB`, `OrderConfirmation`, `ChatDrawer`, `DnaChat`, `SearchOverlay`, `PalaceHeader`, `HeroScene`, `WorldPage`, `WorldHero`, `ConsentBanner`, `Editable`, `PaymentLogos`, `ContractV2Banner`, `campaign/scenes.ts`, `App.css`.
- Ausnahme bleibt: Welt-Kopfbilder (`color`-Prop) und vom Designer selbst gewählte Hausseiten-Themen. Standard-Thema `#F2F2F2` (muted) wird zu `#FFFFFF`.
- Danach eine Regel im Lint-Sinn: keine Hex-Werte außer `#000000`/`#FFFFFF` im `src`-Code.

### 2. Sprache verständlich machen (ganz PAWN)
Ein Glossar-Durchgang über Studio, Admin und öffentliche Seiten. Vorschlag (korrigierbar):

| bisher | neu |
| --- | --- |
| Außenauge | Markenprofil |
| Retrospektive | Rückblick |
| Werkbuch | Notizen |
| Bühne / Nächster Zug | Start / Dein nächster Schritt |
| Hausseite | Deine Markenseite |
| Signatur | Bildsprache |
| Edition | Gemeinsame Kampagne |
| Prüf-Stapel / Jagd (Admin) | Zu prüfen / Designer-Suche |
| Schwelle, Verwandlung | Einladung, Vorher/Nachher |
| Kontingent | Was diesen Monat noch frei ist |

Regel: poetische Sprache bleibt auf der öffentlichen Bühne (Startseite, Weltseiten, leere Zustände), aber **jede Bedienoberfläche** (Studio, Admin, Konto, Kasse) benennt Dinge wörtlich. Jeder Menüpunkt bekommt zusätzlich eine erklärende Kurzzeile.

### 3. Studio-Menü übersichtlich
Aktuell 15 gleichrangige Punkte. Neu in 4 benannte Gruppen:
- **Verkaufen** — Start, Kollektion, Bestellungen, Versand
- **Zeigen** — Markenseite, Mediathek, Kampagnen, Videothek
- **Marke** — Markenprofil, Rückblick, Content-Begleiter
- **Konto** — Plan, Auszahlung, Empfehlungen, Nachrichten, Einstellungen

Gruppen aufklappbar, aktive Gruppe bleibt offen, mobil identisch. Keine neue Route, nur Struktur + Beschriftung.

### 4. Hausseite prüfen und PAWN-gerecht machen
Bestandsaufnahme des Editors (`StudioHausseite.tsx`, 400 Zeilen) und der Darstellung (`HausseiteBlocks.tsx`): 8 Bausteine und ein Thema-System existieren, aber es fehlt das, was sie benutzbar macht. Geplant:
- **Vorlagen statt leerem Blatt:** 3 fertige Seitengerüste („Ein Stück im Fokus", „Kollektion", „Geschichte des Hauses"), ein Klick füllt die Seite mit den vorhandenen Medien.
- **Live-Vorschau nebeneinander** (Desktop) bzw. umschaltbar (mobil), inkl. Handy-Ansicht.
- **Ehrliche Prüfliste vor Veröffentlichen:** mindestens ein Bild, ein Text, ein Stück verlinkt — sonst Hinweis statt stummem Fehler.
- **Klarer Zustand:** Entwurf / veröffentlicht mit Link zur echten Seite, „Änderungen nicht gesichert"-Hinweis.
- Bausteinnamen entjargonisieren („Auftakt" → „Kopfbild", „banner_seitlich" → „Bild mit Kaufhinweis").
- Der Datenbank-Teil bleibt unangetastet (nur Lesen/Schreiben wie bisher).

### 5. Alles Anklickbare prüfen
Automatischer Durchlauf mit einem Browser-Skript über alle Routen (öffentlich, Studio, Admin — mit Test-Session): jeder Link und Knopf wird eingesammelt, tote Ziele (404, `#`, leerer `onClick`, Route existiert nicht) werden gelistet und behoben. Ergebnis kommt als kurze Liste „gefunden / behoben".

### Technisches
- Nur Frontend: `src/**` (Seiten, `StudioShell`, `HausseiteBlocks`, `StudioHausseite`, `index.css`). Keine Migration, keine Edge Function, kein Deploy nötig.
- Sichtbare Texte gehen, wo möglich, über `site_content`/`Editable`, damit du sie ohne Code ändern kannst.
- Abschluss: Typecheck grün, Prüfung bei 390px und iPad, Kurzbericht je Punkt.

### Reihenfolge
1 (Farben) → 2 (Sprache) → 3 (Menü) → 4 (Hausseite) → 5 (Klick-Prüfung als Schlussabnahme).
