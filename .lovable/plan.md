## Ziel

Zwei Bausteine, damit ein Haus seinen Verkauf komplett selbst führen kann:
1. Eine **Sendungsübersicht** (`/studio/versand`) — alles zum Verpacken, Frankieren und Versenden an einem Ort.
2. Ein **vollständiges Stück-Formular** — mehrere Größen pro Stück, echte Maßtabelle, Material, Pflege, und ein Preis **inklusive Mehrwertsteuer**.

---

## 1. Sendungsübersicht (neue Seite im Studio)

Eigener Punkt in der Studio-Navigation, „Versand". Die bestehende Bestellliste bleibt wie sie ist (kaufmännische Sicht) — die neue Seite ist die Arbeitssicht fürs Packen.

**Aufbau**
- **Kopfzeile mit vier Zahlen**: Zu packen · Bereit zum Versand · Unterwegs · Zugestellt.
- **Sendungskarten** statt Tabelle, eine pro Bestellung (nicht pro Artikel), jeweils mit:
  - Lieferadresse als Block, ein Klick kopiert sie komplett in die Zwischenablage (fürs Einfügen ins Portal von DHL/GLS/Post).
  - Inhalt der Sendung: Stück, Größe, Menge, Gewicht je Stück und **Gesamtgewicht** (aus `weight_grams`) — genau das, was das Versandformular braucht.
  - Maße der größten Position als Packhinweis, falls hinterlegt.
  - Feld für Versanddienst + Sendungsnummer, ein Knopf „Als versendet markieren" (setzt Status, Zeitstempel, löst die bestehende Versand-Mail aus).
  - Knopf „Zugestellt".
  - Lieferschein zum Ausdrucken (druckfreundliche Ansicht mit Absender aus den Rechnungsdaten, Empfänger, Positionen, Bestellnummer) — kein PDF-Dienst nötig, Browser-Druck.
- **Filter**: Offen / Unterwegs / Erledigt, plus Suche nach Name oder Bestellnummer.
- **Ehrlicher Leerzustand**: „Noch keine Sendung. Das erste Stück findet seinen Weg."

**Zusätzlich sinnvoll (Teil des Zugs)**
- Absender-/Rückgabeadresse ist bereits in den Rechnungsdaten vorhanden — die Seite zeigt eine Warnung, wenn sie fehlt, weil sonst kein Lieferschein gedruckt werden kann.
- Hinweis, wenn eine Bestellung länger als 48 Stunden bezahlt aber unversendet ist (gleiche Regel, die Jarvis intern schon prüft).

---

## 2. Neues Stück anlegen — vollständige Angaben

**a) Mehrere Größen mit eigenem Bestand**
Heute gibt es Varianten nur als Namen ohne Bestand. Neu: eine Größen-Matrix — je Zeile Größe, Bestand, optional eigener Aufpreis und eigene Artikelnummer. Der Gesamtbestand ergibt sich daraus; ausverkaufte Größen sind im Shop nicht wählbar.

**b) Maßtabelle**
Statt nur Länge/Breite/Höhe (das sind Paketmaße) eine echte Maßtabelle pro Größe: frei wählbare Zeilen wie Schulter, Brust, Taille, Ärmellänge, Gesamtlänge — in cm, je Größe ein Wert. Auf der Produktseite erscheint sie als saubere Tabelle. Für Interior/Kunst bleiben die einfachen Objektmaße.

**c) Material & Pflege**
- Materialzusammensetzung als Liste mit Prozentangabe (z. B. 80 % Wolle, 20 % Seide) mit Summenprüfung auf 100 %.
- Futter/Beschläge als Freitext.
- Pflegehinweise als anklickbare Standardsymbole (Handwäsche, nicht bleichen, chemische Reinigung …) plus Freitext.
- Herkunft der Fertigung (bereits vorhanden) bleibt.

**d) Mehrwertsteuer**
- Im Haus-Profil: **Mehrwertsteuersatz des Landes** (Standard, z. B. 19 %) und die bereits vorhandene Kleinunternehmer-Angabe.
- Im Stück: der Satz kann pro Stück abweichen (ermäßigt/befreit).
- Der eingetragene Preis ist immer der **Endpreis inklusive Mehrwertsteuer**. Direkt darunter rechnet das Formular live vor: Nettobetrag und enthaltene Steuer.
- Überall wo der Preis erscheint (Shop, Produktseite, Warenkorb, Kasse): „inkl. MwSt., zzgl. Versand". Bei Kleinunternehmer stattdessen der gesetzliche Hinweis, dass keine Umsatzsteuer ausgewiesen wird.
- Rechnungen und Bestellungen speichern Satz und Steueranteil mit, damit die Buchhaltung stimmt.

**e) Was sonst noch fehlt — mit aufgenommen**
- **Pflichtfeld-Prüfung vor dem Veröffentlichen**: ohne Bild, Preis, Material und Versandgewicht bleibt ein Stück Entwurf. Eine kleine Fortschrittsanzeige „Bereit zum Veröffentlichen" zeigt, was noch fehlt.
- **Versandgewicht ist Pflicht**, weil ohne Gewicht kein Versandschein möglich ist.
- **Rückgabefrist** je Haus (Standard 14 Tage) für die Produktseite.
- **Nachhaltigkeits-/Herkunftsnotiz** optional, passt zur Handschrift von PAWN.

---

## Technische Details

- Neue Spalten auf `products`: `size_variants` (jsonb: Größe, Bestand, Aufpreis, SKU), `measurements` (jsonb: Zeilen × Größen), `material_composition` (jsonb), `care_symbols` (text[]), `vat_rate` (numeric, nullable → Haus-Standard).
- Neue Spalten auf `designers`: `vat_rate` (numeric, Standard 19), `return_window_days` (int, Standard 14).
- `orders`: `vat_rate` und `vat_amount_cents` je Position beim Checkout mitschreiben.
- Bestandsabbau (`decrement_stock_for_order`) berücksichtigt künftig die gewählte Größe.
- `create-checkout` und `stripe-webhook` müssen die Steuerangaben mitführen → **beide brauchen ein Neu-Deploy über Lovable** (kostet Credits); alles andere läuft über Git.
- Neue Datei `src/pages/studio/StudioVersand.tsx`, Route + Navigationseintrag in `StudioShell`; Datenzugriff über den vorhandenen `useDesignerOrders`-Hook, um eine Sendungssicht erweitert.
- Produktformular in `StudioProducts.tsx` wird in kleinere Abschnittskomponenten zerlegt (Größen, Maße, Material, Preis & Steuer), damit die Datei nicht weiter wächst.
- Design bleibt strikt Schwarz/Weiß, keine Rundungen, harte Kanten.

## Reihenfolge

1. Datenbank-Erweiterungen (eine Migration).
2. Produktformular: Preis & Steuer, Größen-Matrix, Maße, Material/Pflege.
3. Anzeige der Steuerhinweise in Shop, Produktseite, Warenkorb, Kasse.
4. Sendungsübersicht inkl. Lieferschein-Druck.
5. Checkout-/Webhook-Anpassung (Deploy nötig).
