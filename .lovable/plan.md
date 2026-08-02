## Was ich geprüft habe (mit Nachweis)

**Der Testartikel von Haus Obara ist in der Datenbank völlig in Ordnung.** Ich habe ihn über die öffentliche Schnittstelle abgerufen: Status `published`, Haus `obara` aktiv, Bild-Link liefert HTTP 200. Es liegt also nicht an Rechten oder Daten.

**Der Fehler liegt im Frontend.** Ich habe die Seite `/product/obara-test-msa28gai` in einem Testbrowser geöffnet — sie bleibt weiß. Im Protokoll steht:

```text
PAGEERROR  Cannot read properties of undefined (reading 'length')
The above error occurred in the <ProductDetailsTable> component
    at ProductDetail.tsx
```

Ursache: In `ProductDetailsTable` wird `measurements.rows.length` gelesen. Beim Obara-Stück ist `measurements` ein leeres Objekt `{}` — `rows` existiert nicht, der Zugriff stürzt ab und reißt die ganze Seite mit. **Jedes Stück ohne ausgefüllte Maßtabelle ist damit unerreichbar.** Das trifft alle bisher angelegten Artikel.

**Zweiter, sichtbarer Fehler:** Auf der Hausseite steht bei „Akt III · Kollektion" *NO IMAGE*, obwohl ein Bild hinterlegt ist. Grund: die Abfrage in `DesignerPage.tsx` (Zeile 244) holt nur `id, slug, name, price` — das Feld `image_url` fehlt. Eine zweite Abfrage weiter oben holt es korrekt, die für den Kollektions-Akt nicht.

**Dritter Fund:** Die Boutique `/shop` zeigt „0 Stücke". Sie liest aus dem alten lokalen Beispiel-Speicher (`useStore(marketplaceSelectors)`), nicht aus der Datenbank. Echte Artikel können dort gar nicht erscheinen.

---

## Plan

### 1. Sofortfixes — Artikel sichtbar machen
- `ProductDetailsTable` gegen leere Felder absichern (`measurements`, `size_variants`, `material_composition`, `care_symbols` defensiv lesen). Kein Absturz mehr bei unvollständigen Stücken.
- Eine Fehlerbrücke (Error Boundary) um die Produktseite: falls doch etwas fehlt, sieht der Kunde das Stück statt einer weißen Seite.
- `image_url` in die Kollektions-Abfrage der Hausseite aufnehmen; Produktseite und Karten zeigen das echte Foto statt des Platzhalters, Platzhalter nur wenn wirklich kein Bild da ist.

### 2. Boutique an die echte Datenbank hängen
- `Shop.tsx` liest künftig aus `products` (nur `status = published`) mit Haus-Name, Bild, Preis, Welt.
- Filter auf echte Werte umstellen: Welt (Mode/Interior/Kunst), Haus, Preis, Größe aus `size_variants` — keine erfundenen Kategorien mehr, die nie treffen.
- Ehrlicher Leerzustand statt „0 Stücke" mit vollen Filterlisten.

### 3. Artikel anlegen — auf Launch-Niveau
- Pflichtfelder-Prüfung vor dem Veröffentlichen (Bild, Preis, Welt, mindestens eine Größe/Variante, Bestand oder Anfertigung, Mehrwertsteuersatz) mit klarer Liste statt stiller Fehler.
- Entwurf-Automatik: unvollständige Stücke bleiben Entwurf, mit Hinweis was fehlt.
- Vorschau „So sieht dein Stück für Kunden aus" direkt im Editor.
- Bestand 0 + Lagerware = Stück wird als ausverkauft angezeigt statt kaufbar (heute steht Obara auf 0 und wäre trotzdem im Verkauf).

### 4. Anmeldung Kunde & Designer
- `/auth` und `/apply` durchklicken und die Kanten glätten: Passwort vergessen (Seite `/reset-password` existiert noch nicht — wird angelegt), verständliche Fehlermeldungen auf Deutsch, klarer Hinweis „Bitte bestätige deine E-Mail" nach Registrierung.
- Nach Anmeldung Weiterleitung je Rolle prüfen (Kunde → Konto, Designer → Studio, Admin → Cockpit).

### 5. Admin-Cockpit verständlicher
- Gleiche Behandlung wie das Studio: Menü in vier Bereiche gruppiert (**Häuser · Verkauf · Sichtbarkeit · System**) mit einer Erklärzeile je Punkt.
- Startseite des Cockpits: die drei Dinge, die heute Aufmerksamkeit brauchen, in Klartext („2 Bewerbungen warten", „1 Bestellung seit 48 h nicht versendet").

### 6. Deine-DNA-Seite: was sie ist und wohin sie geht
**Heute** kann `/dna`: ein Stil-Urteil in Worten (Stilberater), einen Kompass mit Zielrichtung, ein Gespräch mit Bild-Upload, „Steht mir das?" und eine Liste der Signale, die PAWN sich gemerkt hat — jedes einzeln löschbar.

**Was fehlt, damit sie trägt:** Die Signale beeinflussen die Boutique bisher kaum sichtbar. Geplant:
- Direkt unter dem Urteil eine Reihe **„Deshalb zeigen wir dir das"** — echte Stücke aus der Datenbank, jedes mit einem Satz Begründung.
- Ein Zustand für Erstbesucher, der in drei Fragen zu einem ersten Profil führt, statt einer leeren Seite.
- Der Kompass wirkt auf die Sortierung in `/shop` und auf die Startseite — sichtbar, abschaltbar.

### 7. Abschluss
Typecheck grün, danach ein Durchklick-Nachweis je Punkt: Produktseite lädt, Boutique zeigt Obara, Anmeldung funktioniert, Admin-Menü sauber.

---

### Technische Details
- Betroffene Dateien: `src/pages/ProductDetail.tsx`, `src/pages/DesignerPage.tsx` (Z. 244), `src/pages/Shop.tsx`, `src/features/products/useDbProduct.ts`, `src/pages/studio/StudioStueckNeu.tsx`, `src/pages/Auth.tsx` (+ neue `ResetPassword.tsx`), `src/components/pawn/AdminShell.tsx`, `src/pages/admin/AdminOverview.tsx`, `src/pages/DNA.tsx`.
- Keine Datenbank-Migration nötig; keine Edge-Function-Änderung, also keine Deploy-Kosten.
- Bestehende Rechte-Regeln bleiben unangetastet (öffentliches Lesen ist bereits korrekt konfiguriert).
