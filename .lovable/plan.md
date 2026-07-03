## Kernfusion — Der Bauer bewegt sich

Wir behalten die komplette Architektur (Core, Events, Reducers, DNA, Moments M1–M8) und legen darüber **eine einzige narrative Schicht**: PAWN als Partie. Jeder Nutzer ist ein Bauer. Jede Interaktion ist ein Zug. Die DNA ist der Weg über das Brett. Am Ende: Promotion.

Wir wählen **Lesart C** (kontinuierlich + Schwellen), weil sie beide bereits existierenden Systeme trägt: die kleinen Momente (M2, M3, M5) sind Züge; die großen (M6-Mutation, M7-Kauf) sind Promotions.

Keine Datenbankänderung. Keine neue Route. Keine Feature-Erweiterung. Nur Bedeutungsverdichtung der vorhandenen Oberfläche.

---

### 1 · Ein neues narratives Vokabular (`src/features/narrative/`)

Ein zentrales Modul, das die Sprache des Brettes bereitstellt — damit jede Oberfläche dieselben Worte spricht.

- `pieces.ts` — Mapping Genom → Figur. Die dominanteste Genom-Achse eines Nutzers bestimmt seinen aktuellen „Schatten der Figur" (structure→Turm, edge→Springer, elegance→Läufer, darkness→Dame, sensuality→Läufer, utility→Turm). Der Bauer bleibt Startpunkt.
- `moves.ts` — Zählt Züge (aus dem Event-Log ableiten: jede Wahl, jedes Save, jede Mutation = 1 Zug). Reine Selektor-Logik.
- `rank.ts` — Der aktuelle Rang des Bauern (0–7). Berechnet aus Zug-Anzahl + DNA-Kohärenz. Promotion bei Rang 8 = erster Kauf ODER genug Kohärenz.

Kein neuer State — alles abgeleitet aus dem existierenden Event-Log.

---

### 2 · Der Symbolsatz — was bleibt, was wird umgedeutet

**Bleibt unverändert:**
- Logo (Wortmarke oben) — die Signatur, nicht das Symbol.
- PawnMark-Glyphe — bleibt, aber wird zur **einzigen Figur** auf jeder Seite. Nur eine pro Viewport.

**Wird umgedeutet:**
- `ChessDivider` → **RankDivider**. Zeigt visuell den aktuellen Rang des Bauern (kleine Marker 1–8, aktueller hervorgehoben). Jede Section-Grenze = ein Rang weiter.
- `PageLabel` (die „01 — Shadow" etc.) → **entfernt überall dort, wo sie nur katalogisieren**. Bleiben nur, wo sie einen echten Zug markieren (Home-Hero-Panels als „Zug I / Zug II"). Alle Section-„01 Featured Houses" etc. verschwinden.
- Nummerierungen 01/02 → **Zugnummern** in Schach-Notation-Ästhetik (dünn, monospace, klein), nicht editorial-magazine.

---

### 3 · Home (`src/pages/Index.tsx`) — Die Eröffnung

**FirstVisitDoor** (M1) wird zu **„Die Eröffnung"**:
- Titel weg (kein „Wähle einen Raum"). Statt dessen: eine schmale Zeile *„Weiß beginnt. Dein erster Zug."*
- Der PawnMark in der Mitte ist die Figur des Nutzers. Nach dem Klick auf ein Panel **animiert er sichtbar ein Feld in die gewählte Richtung** (300ms Translate), bevor die Seite rekomponiert. Das ist der Beweis: der Bauer hat sich bewegt.
- Panels: „I" / „II" bleiben (Zugnotation), aber die Sub-Zeilen werden knapper („Licht." / „Schatten." — ein Wort).

**Nach dem ersten Zug (Hero):**
- Statt zwei parallele Panels → das gewählte Feld wird groß, das ungewählte schrumpft zu einem schmalen Streifen am Rand („der nicht gespielte Zug bleibt sichtbar"). Die Wahl bleibt reversibel via Klick auf den Streifen, aber sie hat visuelles Gewicht.
- Über der Headline: kleine Zug-Signatur `1. e4` — die tatsächliche Notation der ersten Entscheidung des Nutzers.

**Sections darunter:**
- `ChessDivider` bekommt Rang-Indikator: `— II —` zeigt, dass wir jetzt auf Rang 2 des Brettes sind (Section 2).
- Section-Titel verlieren ihre „01/02" Präfixe. Die Rang-Position steht im Divider, nicht im Heading.
- „The Houses" / „The Pieces" bleiben — sie sind bereits Schach-Sprache und tragen das Narrativ.

---

### 4 · DNA (`src/pages/DNA.tsx`) — Das Brett des Selbst

Der bereits existierende DNAVisual bleibt strukturell, wird aber neu gerahmt:
- Header-Zeile: *„Du bist auf Rang [N]. [M] Züge gespielt."* (aus `rank.ts`/`moves.ts`).
- Neben dem Genom-Radar: der **Figur-Schatten** — welche Figur der Bauer aktuell am ehesten wird, wenn er promoviert. Kleine PawnMark mit dünner Überlagerung der Ziel-Figur (Turm/Läufer/Springer/Dame). Reine SVG-Komposition.
- Bei Mutation (M6): das existierende `MutationMoment` bekommt einen Satz-Zusatz: *„Ein Feld weiter."* Der Genom-Balken animiert weiterhin — aber jetzt ist klar, was passiert ist.

---

### 5 · Product Detail (`src/pages/ProductDetail.tsx`) — Ein Zug in Betracht

- DNA-Match-Prozent wird gerahmt als *„Dieses Stück würde dich [N]% näher an [Figur] rücken."* — der Nutzer sieht, was ein Kauf mit ihm macht, nicht nur wie sehr das Produkt „passt".
- Save (M3): die existierende Bild-Atmung bleibt. Zusätzlich: kleine Zeile unter dem Preis nach Save: *„Notiert. Zug [N+1]."*
- Provenance (M5) bleibt unverändert — sie ist bereits Beweis-auf-Nachfrage.

---

### 6 · Checkout / Purchase (`src/pages/Checkout.tsx`) — Die Promotion

Der existierende Ein-Frame-Moment „Es gehört jetzt dir." wird zum **Promotions-Ritual**:
- Wenn der Kauf den Bauern auf Rang 8 bringt (erster Kauf ODER Kohärenz-Schwelle): der PawnMark verwandelt sich sichtbar in seine Figur (SVG-Morph, 1.2s). Ein zweiter Satz erscheint: *„Der Bauer ist gefallen. [Figur] steht."*
- Bei allen weiteren Käufen: der bisherige Frame bleibt, aber der Rang-Zähler erhöht sich in der Ecke.

Kein Modal, keine Fanfare. Ein Frame, wie gehabt.

---

### 7 · RoomShift-Zeilen (`src/features/os/roomShift.tsx`)

Die schmalen Hairline-Zeilen, die heute Kontext erklären („Weil du Schatten gewählt hast."), bekommen konsistente **Schach-Kadenz**:
- Nach Zug: *„1. [Notation]."*
- Nach Return (M4): *„Die Partie ruht seit [Zeit]. Es liegt an dir."*
- Nach Mutation: *„Ein Feld weiter — [Achse]."*

Ein einziges Vokabular, das durch die ganze App klingt.

---

### 8 · Was NICHT passiert

- Kein Data-Model-Change. Rang und Züge sind Selektoren.
- Kein Bruch existierender Moments. M1–M8 tragen jetzt Bedeutung, ihre Mechanik bleibt.
- Kein Schach-Kitsch. Keine Brett-Grafiken als Deko. Keine Springer-Icons als Bullets. Die Sprache ist Schach, die Ästhetik bleibt PAWN (Ivory/Ink/Bone, Cormorant, Serif).
- Kein neuer Feature-Screen. Alles legt sich in Vorhandenes.

---

### Technische Reihenfolge

1. `src/features/narrative/` anlegen (pieces, moves, rank) — reine Selektor-Module über Event-Log.
2. `ChessDivider` erweitern um `rank`-Prop; alle Nutzungen aktualisieren.
3. `PageLabel`-Nutzungen prüfen: entfernen wo redundant, umbenennen wo Zug-tragend.
4. `Index.tsx`: FirstVisitDoor + Hero-nach-Wahl umbauen (Bauer-Animation, geschrumpfter Streifen des nicht-gewählten Zugs).
5. `DNA.tsx`: Rang-/Zug-Header, Figur-Schatten-Overlay.
6. `MutationMoment.tsx`: Satz-Zusatz.
7. `ProductDetail.tsx`: Match-Rahmung + Save-Zeile.
8. `Checkout.tsx`: Promotions-Zweig für Rang-8-Erreichung.
9. `roomShift.tsx`-Aufrufer: Notation-Vokabular vereinheitlichen.

Jeder Schritt ist eigenständig lauffähig — kein Big-Bang.

---

### Der Beweis, dass die Fusion gelungen ist

Wenn ein neuer Nutzer die Seite betritt und nach drei Klicks — ohne einen einzigen Erklärtext gelesen zu haben — versteht: *„Ich bewege eine Figur. Ich spiele eine Partie mit mir selbst. Am Ende werde ich etwas."* Dann ist das Skelett zur Kreatur geworden.
