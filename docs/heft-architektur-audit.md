# Heft-Architektur-Audit — vor dem Neuaufbau

Stand: 18.08.2026, Zweig `claude/pawn-prototype-admin-structure-o4p87a` (nach X1).
Gelesen wurde alles unter `src/heft/` (5.668 Zeilen): `Heft.tsx`, `wendel.ts`,
`doppelseiten.ts`, `heft.css`, `spreads/`, die Datenschichten (`verzeichnis`,
`werk`, `haeuser`), die Seitenmöbel (`register`, `marken`, `drehhinweis`) und
die Tests. **Es wurde nichts gebaut.** Dieses Dokument beantwortet die sechs
Audit-Fragen und schlägt den minimalen Neuaufbau vor.

---

## Das Übersetzungsproblem, in Zahlen

Zwischen der Absicht „ich will die nächste Szene sehen" und dem Inhalt liegen
heute **sechs Übersetzungen**, jede mit eigenem Zustand:

```
scrollY  (ein UNECHTER Scroll: die Bühne steht fest, ein leerer
          Streifen von blaetter × 900px + Fensterhöhe trägt den Rollbalken)
  → blattStand(y, i)          Rotation, z-Flip bei e=0,5, Knickschatten
  → Blatt-Index               N Doppelseiten → N−1 Blätter; Vorderseite von
                              Blatt i = RECHTE Seite von Spread i, Rückseite
                              = LINKE Seite von Spread i+1
  → Doppelseiten-Nummer       gerundet bei der Hälfte des Wendels; im
                              Einzelseiten-Modus ÷2, zwei Seiten je Adresse
  → Route                     replace-Navigation, gegen Rückkopplung gesichert
  → Inhalt                    Seitenliste, mit nachgereichten Sprungtabellen
                              (werkNummer, hausNummer), weil Nummern beim
                              Bauen noch nicht feststehen
```

Drei Besitzer beschreiben denselben Fakt (Scrollstand, Route, React-State), und
jeder Übergang braucht eine Wache, damit sie sich nicht gegenseitig anstoßen:

- `startSeite` wird **bewusst nur einmal** gelesen — sonst schlüge das eigene
  Adress-Fortschreiben zurück. Folge: eine SPA-Navigation auf eine Heftadresse
  mitten in der Sitzung tut **nichts**. Deshalb muss jeder interne Link im Heft
  seinen Klick abfangen und `aufSprung`/`aufWerk`/`aufHaus` rufen — eine ganze
  Klasse von Sonderbehandlung, die nur existiert, weil die Route nicht der
  Besitzer des Zustands ist.
- `nachzuholen` holt genau einmal eine Adresse nach, die es beim Betreten noch
  nicht gab (Werke aus Daten) — ein Einmal-Pflaster über derselben Wunde.
- `letzte`-Ref dedupliziert Adress-Schreibvorgänge; `replace` statt `push`,
  damit der Zurück-Knopf nicht zwölf Einträge frisst — wodurch Zurück im Heft
  faktisch „Scrollposition wiederherstellen" bedeutet, nicht „einen Schritt".

Dazu kommen **drei Darstellungswege desselben Inhalts**: der 3D-Wendel, der
Einzelseiten-Wendel (eigene Stapel-Ableitung `einzelseitenAus`, eigenes
Scharnier, eigene Adress-Arithmetik) und die senkrechte Folge (eigener
Renderer, IntersectionObserver für die Adresse). Jede Messrunde des Prüfstands
hat Fehler **in den Nähten** dieser Modi gefunden, nicht in den Inhalten.

---

## 1 · Was ist wirklich notwendig?

Notwendig sind **Anforderungen**, nicht Mechanik:

| Bleibt | Warum |
|---|---|
| **Die Seitenliste** (`spreads/index.tsx`, Reihenfolge = Dramaturgie) | Das ist der Inhalt und der Rhythmus des Hefts. Eine Liste, eine Wahrheit. |
| **Der Satzspiegel** (`satzspiegel.tsx`: Kicker, Schlagzeile, Vorspann, Fliesstext, Bildunterschrift, Folio, Weg) | Das ist die Qualität. Komposition, Typografie, Hierarchie — unabhängig von jeder Wendemechanik. |
| **Die Platten** (`platte.tsx`, srcset, `public/heft/`) | Bildsprache. (Ohne den Bund-Doppeldruck, s. Frage 2.) |
| **Die Datenschichten** (`verzeichnis.tsx`, `werk.tsx`, `haeuser.tsx` inkl. Haus-Stil) | Katalog, Werke, Kapitel — reine Daten→Inhalt-Übersetzung, kein Papier. |
| **Adresse je Ansicht** (`pfad` an jeder Einheit, `nummerFuerPfad`-Idee) | Deep Links, Zurück, SEO, Prüfstand. Nicht verhandelbar (X2). |
| **Register + Marken** | Die räumliche Verortung („wo bin ich, wohin kann ich") — funktioniert schon heute in allen Modi gleich. |
| **Die Ehrlichkeits-Kennzeichen** (`data-daten-fehlen`, 404-Ersatz) | Messbarkeit. |
| **Ton/Stil je Einheit** (papier/nacht, `data-haus`) | Rhythmus (X4) und die Haus-Handschrift (X8). |

## 2 · Was existiert nur, weil wir Papier simulieren?

| Simulation | Zeilen (ca.) | Bemerkung |
|---|---|---|
| `wendel.ts` komplett | 102 | Rotationsmathematik, Easing, Knick, z-Flip |
| Blatt-Ableitungen (`blaetterAus`, `einzelseitenAus`) | ~120 | Existieren nur, weil Inhalt auf **Vorder- und Rückseiten rotierender Blätter** geklebt werden muss |
| `HeftGewendet` (Refs, Fenster ±2, Endzustands-Schreiben, `inert`-Buchführung, Remount-`key` beim Moduswechsel) | ~250 | Alles Betriebskosten der 3D-Bühne |
| Der unechte Scroll (`hx-weg`-Streifen, Scrollhöhen-Nachführung) | ~30 + CSS | „Kein Scroll-Diebstahl" stimmt nur formell: die Seite scrollt, aber nichts bewegt sich außer Blättern |
| Einzelseiten-Arithmetik (`doppelseiteFuerSeite`, `ersteSeiteVon`, zwei Seiten je Adresse) | ~20 + Verzweigungen | Folgekosten der Doppelseite als Navigationseinheit |
| `PlatteBund`-Doppeldruck (dasselbe Bild zweimal bei 200 % Breite, je Bundhälfte) | ~40 | Ein Bild kann nicht über zwei getrennte Blattflächen laufen — also wird es zweimal gedruckt |
| 3D-CSS: `hx-blatt`, `hx-flaeche` vorn/rück, `backface-visibility`, Knick, Grund links/rechts, Perspektive | ~200 in `heft.css` | |
| **Der Dreh-Hinweis** (`drehhinweis.tsx`, 162 Zeilen + `NIE_SPERREN` + `?text=1`-Tür) | ~180 | Existiert, weil eine DOPPELSEITE nicht ins Hochformat passt. Eine Szene passt. Der Hinweis ist die teuerste Folgekost: er sperrt Telefon-Nutzer im Hochformat aus dem Produkt aus. |
| Die Folge als **zweiter Renderer** | ~50 + CSS | Nötig, weil der erste Weg ohne Bewegung nicht funktioniert. Ein Weg, der einen Ersatzweg braucht, trägt die Beweislast. |

Summe: grob **900–1.000 Zeilen TS/TSX + ~⅓ von `heft.css`** dienen der
Papierphysik, nicht dem Inhalt.

## 3 · Welche Logik erzeugt die Hakeligkeit?

1. **Scroll als Tween-Regler.** Scrollen ist kontinuierlich und trägheitsbehaftet;
   das Heft bildet es linear auf Blattrotation ab (900 px je Wendung, fest).
   Folgen: man kann **mitten in einer Wendung liegen bleiben** (Blatt bei 90°),
   der Impuls **rastet nirgends ein** (kein natives scroll-snap auf einem
   unechten Scroll), und Trackpad, Mausrad und Touch haben völlig verschiedene
   Geschwindigkeiten gegen dieselbe Konstante. Das IST das hakelige Gefühl.
2. **Ein Bild Verzögerung by design.** Passiver Listener + rAF-Drossel: die
   Blätter laufen dem Finger einen Frame hinterher.
3. **Gestenkonflikt, eingebaut.** Im Einzelseiten-Modus heißt die Scrollgeste
   „wenden" — aber seit dem Z4-Fix rollt ein zu hoher Satzspiegel **im Blatt**.
   Dieselbe Geste, zwei Bedeutungen. (Der Z4-Fix war genau die Sorte
   CSS-Pflaster, die die harte Regel dieses Resets verbietet — er steht hier
   als Beleg, nicht als Empfehlung.)
4. **Adresse kippt bei halber Wendung**, während das Bild mitten im Flug ist —
   Titel, Register-Markierung und Folio wechseln sichtbar asynchron zum Blatt.
5. **Die Wachen** (startSeite-einmal, nachzuholen-einmal, letzte-Dedupe) machen
   das System an genau den Stellen taub, wo eine App lebendig sein müsste:
   interne Navigation, spätes Eintreffen von Daten, Moduswechsel (Remount).

## 4 · Was kann vollständig entfernt werden?

Alles aus Tabelle 2. Konkret ersatzlos: `wendel.ts`, `blaetterAus`,
`einzelseitenAus`, `HeftGewendet` samt Fenster-/inert-/Ref-Apparat, der
`hx-weg`-Streifen, die Einzelseiten-Arithmetik, der `PlatteBund`-Doppeldruck,
der Dreh-Hinweis samt Sperrliste und `?text=1`-Tür, die Folge **als zweiter
Renderer** (ihr Grundriss wird der einzige), und die 3D-Schicht in `heft.css`.

## 5 · Der Neuaufbau mit ≤ 20 % der Komplexität: die Szenen-Maschine

**Prinzip:** Die Route ist der einzige Besitzer des Zustands. Eine Szene ist
eine Kompositionsfläche mit Adresse. Bewegung ist ein Übergang zwischen zwei
Szenen — nicht die Simulation des Wegs dazwischen.

```ts
interface Szene {
  schluessel: string;
  pfad: string;              // Adresse = Identität (bleibt aus X2)
  titel: string;             // die eine h1
  sektion: string;           // Register-Markierung
  ton: "papier" | "nacht";
  stil?: HausStil;           // X8 unverändert
  inhalt: ReactNode;         // EINE Fläche — kein links/rechts-Schnitt
}

// Der gesamte Maschinenraum:
aktuelleSzene = szeneFuerPfad(route)        // pure Funktion, kein Zustand
blaettern(richtung) = navigate(nachbar.pfad) // Zurück-Knopf = ein Schritt zurück
Übergang = View Transition / 2-Elemente-Blende (transform + opacity)
```

- **Eingaben werden Absichten, keine Positionen:** Radimpulse werden zu EINEM
  Schritt akkumuliert, Wischen ist ein Schritt, Pfeiltasten sind ein Schritt,
  Register/Inhaltsverzeichnis sind `navigate` — **ohne Klick-Abfangen**, weil
  die Route der Zustand ist. Alle Rückkopplungs-Wachen entfallen ersatzlos.
- **Die Doppelseite wird Layout, nicht Navigation:** dieselbe Szene legt sich
  breit zweispaltig (Platte links, Satz rechts — via CSS-Grid) und schmal
  einspaltig. Damit sterben: Einzelseiten-Modus, Bund-Doppeldruck,
  Dreh-Hinweis. **Hochformat wird ein Format, keine Sperre.**
- **Ein zu hoher Satzspiegel rollt einfach** — senkrechtes Rollen in der Szene
  ist normales DOM-Rollen, Schritte sind explizit. Der Gestenkonflikt ist weg.
- **Reduced Motion ist eine Übergangsdauer von 0** im selben Renderer — kein
  zweiter Weg, keine `?text=1`-Tür.
- **Welt → Fokus → Objekt** entsteht aus den Übergängen: aus dem Verzeichnis
  ins Werk wächst das Werkbild aus seiner Kachel (die `fliege`-Mechanik des
  Lichttischs existiert schon und beweist das Muster), zurück fällt es dorthin
  zurück. Die Qualität liegt in Komposition und Übergang, nicht in Physik.
- **Späte Daten sind kein Sonderfall:** eine Adresse, deren Szene noch nicht
  da ist, zeigt das Szenengerüst mit dem ehrlichen Satz (`data-daten-fehlen`),
  und die Route matcht, sobald die Szene existiert. `nachzuholen` entfällt.

**Größenschätzung:** Maschine (Route→Szene, Übergang, Eingabe-Absichten)
~150 Zeilen; Szenenliste, Satzspiegel, Platten, Datenschichten, Register,
Marken bleiben. Ersetzt werden ~1.000 Zeilen Mechanik durch ~150 — unter der
20-%-Marke, und die Regel am Ende des Auftrags ist eingehalten: die Lösung ist
kleiner als das, was sie ersetzt.

## 6 · Wie bleiben die harten Anforderungen erhalten?

| Anforderung | Im Szenen-Modell |
|---|---|
| Deep Links | Route = Zustand. Jede Szene ist ihre Adresse; nichts zu synchronisieren. |
| Browser Back | Jeder Schritt ist ein History-Eintrag (push, nicht replace) — Zurück blättert wirklich einen Schritt, statt eine Scrollposition zu raten. |
| Accessibility | Nur die aktuelle Szene (± Nachbarn für den Übergang) ist im aktiven Baum; verborgene Szenen sind `display:none` — die `inert`-Buchführung entfällt, weil nichts mehr übereinander gestapelt ist. |
| SEO | Eine Szene je Adresse, eine `h1` je Route (bleibt); X11 (Vorrendern der bekannten Adressen) liefert echtes HTML je Adresse und löst zugleich 4.5 — unverändert geplant. |
| Werkseiten | Szenen aus Daten, wie heute die Spreads — nur ohne Sprungtabellen, weil `navigate` genügt. |
| Responsive | Layoutfrage der Szene (Grid), keine Modus-Arithmetik. Hochformat wird bedienbar statt gesperrt. |
| Touch | Wischen = ein Schritt; senkrecht rollen = Inhalt. Zwei Gesten, zwei Bedeutungen, kein Konflikt. |
| Reduced Motion | Gleicher Renderer, Übergangsdauer 0. |
| Echte Navigation | Register, Marken, Inhaltsverzeichnis, Weltzeilen: gewöhnliche Links. Das Klick-Abfangen (`aufSprung`/`aufWerk`/`aufHaus`) wird ersatzlos gestrichen. |

## Offen zu entscheiden (bewusst NICHT hier entschieden)

1. **Übergangs-Charakter:** View-Transitions-API (nativ, mit Fallback-Blende)
   gegen handgebaute 2-Elemente-Transition. Empfehlung: View Transitions mit
   Blende als Fallback — am wenigsten eigener Code.
2. **Folio/Blattmetapher im Bild:** Das Heft darf weiter wie Papier AUSSEHEN
   (Papier auf Tisch, Folios, harte Kanten). Der Audit nimmt nur die Physik,
   nicht die Anmutung. Wie viel „Buch" im Übergang bleibt (eine angedeutete
   Wendung als kurze, nicht scrubbare Transition?), ist eine Designfrage.
3. **X.blatt / Ausnahme A1:** misst die Geometrie der Simulation. Mit dem
   Szenen-Modell wird die Kontrolle neu definiert (Szenen-Geometrie statt
   Blattverhältnis) — A1 wird dadurch gegenstandslos oder neu gefasst. Bis zur
   Entscheidung wird A1 nicht weiter verfolgt.
