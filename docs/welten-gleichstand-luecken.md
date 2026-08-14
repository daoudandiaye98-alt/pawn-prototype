# Welten-Gleichstand — Lückenliste Kunst & Interior

Stand: Teil Q, Aufgabe 4. Erhoben durch Lesen des Codes, nicht geschätzt.
Quellen: `StudioStueckNeu.tsx` (Anlege-Flow), `ProductDetail.tsx` (Werkseite),
`Shop.tsx` (Boutique-Filter), `StudioPayout.tsx` (Versandsätze),
`ai_config.staging_templates` + `detect-object` (Bild-Werkzeuge),
`fashion_ontology` (Ontologie).

## Kurzfassung

Mode ist gebaut. **Kunst ist angefangen** (vier Felder aus PART 51). **Interior
existiert als Wort, nicht als Welt** — es hat null eigene Felder. Der Anlege-Flow
fragt die Welt erst an dritter Stelle und zeigt danach für alle drei Welten
dieselben Felder, inklusive „Größe" bei Kunst.

---

## 1. Anlege-Flow (`StudioStueckNeu.tsx`)

| | Mode | Kunst | Interior |
|---|---|---|---|
| Welt wird zuerst gefragt | — | **fehlt** | **fehlt** |
| Größe / Passform | vorhanden | **wird fälschlich angezeigt** | **wird fälschlich angezeigt** |
| Eigene Felder | Größe, Bestand | Technik, Medium, Jahr, Angebotstyp | **keine** |

**Kunst fehlt:** Maße H×B×T · Auflage mit Nummerierung (nur „Original/Print" als
Typ, keine Auflagenzahl) · Signatur (ja/wo) · Rahmung · Zustand · Trägermaterial.

**Interior fehlt vollständig:** Maße H×B×T · Gewicht · Material/Holzart ·
Oberfläche/Finish · Farbe · Fertigung (Einzelstück/Kleinserie/auf Bestellung) ·
Fertigungs- und Lieferzeit · Montagehinweis · Pflegehinweis · Sitzhöhe/Belastbarkeit ·
Varianten (Größe/Material/Stoff) als Auswahl · Angebotstypen Maßanfertigung und
Materialmuster.

**Wo es hingehört:** `products.product_dna` (jsonb) — dort liegt bereits die
Kunst-Ontologie (`kind`, `technik`, `medium`, `jahr`). Kein Schema-Umbau nötig,
aber die Welt-Weiche und die Felder müssen gebaut werden.

## 2. Angebotstypen und Anfrage-Flow

- Kunst hat vier Typen, davon zwei ohne Warenkorb (Auftragsarbeit, Live-Porträt) —
  **gebaut** (PART 51 Teil C).
- Interior hat **keine** Typen: Maßanfertigung und Materialmuster fehlen, obwohl
  der Anfrage-Flow technisch schon existiert und nur angebunden werden müsste.

## 3. Werkseite (`ProductDetail.tsx`)

Zeigt heute: Welt, Haus, Preis, Beschreibung, bei Kunst `technik`/`medium` im
SEO-Titel. **Es gibt keine Metadaten-Sektion je Welt.** Maße, Jahr, Auflage,
Signatur, Material, Gewicht, Lieferzeit — nichts davon erscheint, auch wenn es
gefüllt wäre. Regel „leere Felder bleiben unsichtbar" ist noch nirgends umgesetzt.

## 4. Boutique-Filter (`Shop.tsx`)

Verfeinerungen heute: Welt · Haus · **Größe** · Preis · Suche.
„Größe" ist ein Mode-Begriff und steht bei allen Welten.

**Fehlt:** bei Kunst Technik und Format · bei Interior Material und Maßbereich.
Die Verfeinerungen müssen an der gewählten Welt hängen, nicht global stehen.

## 5. Versand (`designers.shipping_rates`)

Heute genau drei Pauschalen: **Inland / EU / Welt**. Das ist die Mode-Logik —
ein Paket, ein Preis.

**Fehlt für Kunst:** Rolle/Tube · flach verpackt · Spedition für Großformate ·
Versicherungswert · Selbstabholung · „nur nach Absprache".
**Fehlt für Interior:** Paket · Sperrgut · Spedition mit Terminvereinbarung ·
Selbstabholung · Zustellung bis Bordsteinkante bzw. Verwendungsstelle.

Das ist die Lücke mit den größten Folgen: ein Interior-Haus kann einen Schrank
heute nicht ehrlich versenden, weil die Pauschale nicht passt.

## 6. KI-Hilfen

- Beschreibungstexte, Preisorientierung, Titelvorschläge laufen über die
  Edge Functions (`studio-ai`, `pawn-chat`) mit **einem** Duktus — dem
  Produktduktus. Kein Kunstduktus, kein Möbel-/Objektduktus.
- Preisorientierung kennt weder Format/Technik/Auflage (Kunst) noch
  Material/Aufwand (Interior).

## 7. Bild-Werkzeuge

- `ai_config.staging_templates` ist nach Objektart geschlüsselt und kennt bereits
  `malerei`, `skulptur`, `moebel` — die Erkennung (`detect-object`) liefert diese
  Arten. Die **Inszenierungen** dahinter sind aber auf Produktfotografie gebaut.
- **Fehlt Kunst:** „Werk im Raum" (Maßstab an einer Wand) · Detail-/Textur-Zoom ·
  eigener Bildslot für Signatur/Rückseite.
- **Fehlt Interior:** „Möbel im Raum" · Detail (Kante, Fuge, Oberfläche) ·
  Maßskizze-Slot.

## 8. Ontologie (`fashion_ontology`)

Der Name sagt es: die Tabelle ist auf Mode gebaut und lernt Mode-Vokabular.
Kunst- und Interior-Begriffe (Technik, Trägermaterial, Holzart, Finish) sind
weder eingesät noch in den Kuratierungs-Prompts vorgesehen.

## 9. Mehrwert, der nur bei Kunst/Interior Sinn ergibt

Nichts davon existiert heute:
- **Werkzertifikat** als PDF (Titel, Technik, Maße, Jahr, Auflage, Haus, Signaturhinweis)
- Aufhängungs- und Pflegehinweis
- Urhebernennung im Kaufbeleg
- Pflege- und Maßtext aus den Feldern (Interior)

---

## Was ohne Lovable-Deploy geht — und was nicht

**Über Git allein baubar:** Welt-Weiche, alle Felder, Werkseiten-Metadaten,
Boutique-Verfeinerungen je Welt, Versandprofile (Oberfläche + Datenform),
Angebotstypen Interior, Werkzertifikat als PDF im Browser (wie das Share Kit,
das schon clientseitig rendert).

**Braucht einen Lovable-Deploy (Edge Functions):** Kunst-/Möbel-Duktus und
Preisorientierung in `studio-ai`/`pawn-chat` · neue Inszenierungen in
`generate-staging-shot` · Ontologie-Vokabular in `classify-term` und den
Kuratierungs-Prompts.

**Braucht eine Migration:** die Versandprofile, wenn sie über die drei Pauschalen
hinausgehen sollen (neue Form in `shipping_rates`), sowie ggf. ein Feld für
den Angebotstyp bei Interior — sofern man ihn nicht wie bei Kunst in
`product_dna.kind` legt (empfohlen: legen, dann keine Migration nötig).

---

# Stand nach dem Bau (Teil Q, Aufgabe 4b)

Die Lückenliste oben bleibt stehen, wie sie war — sie ist der Befund. Hier steht,
was davon geschlossen ist und was nicht.

## Geschlossen

| Lücke | Wo |
|---|---|
| Eine Quelle für alles, was eine Welt kennt | `src/lib/weltFelder.ts` (neu) |
| Welt wird zuerst gefragt | `StudioStueckNeu.tsx` — eigener Abschnitt vor „Das Stück" |
| „Größe" verschwindet bei Kunst und Interior | dieselbe Datei: die Felder kommen aus der Welt |
| Kunst-Felder vollständig | Technik, Medium, Maße, Jahr, Auflage, Signatur, Rahmung, Träger, Zustand |
| Interior-Felder überhaupt | Maße, Gewicht, Material, Oberfläche, Farbe, Fertigung, Lieferzeit, Montage, Pflege, Belastbarkeit |
| Angebotstypen für Interior | Maßanfertigung + Materialmuster, beide über denselben Anfrage-Weg wie bei Kunst |
| Metadaten-Sektion auf der Werkseite | `ProductDetail.tsx` — „Angaben zum Werk", leere Felder bleiben unsichtbar |
| Boutique-Verfeinerungen je Welt | `Shop.tsx` — Verfeinerungen hängen an der Welt, „Größe" nur bei Mode |
| Versandprofile | `StudioPayout.tsx` + `weltFelder.ts`: Paket, Sperrgut, Spedition (Bordstein/Verwendungsstelle), Rolle, Flach, Kunstspedition, Selbstabholung, „nur nach Absprache" |
| Werkzertifikat als PDF | `src/features/share/werkzertifikat.ts`, verlinkt auf der Werkseite bei Kunst und Interior |

Zur Versand-Form: die alten drei Pauschalen (`inland`/`eu`/`world`) werden weiter
gelesen **und weiter mitgeschrieben** — sie sind jetzt das Profil „paket". Kein
Haus muss etwas umstellen, und der Checkout liest weiter, was er kennt.

## Nicht geschlossen — und warum

**Braucht einen Lovable-Deploy (Edge Functions):**
- Kunst-/Möbel-Duktus und Preisorientierung in `studio-ai` / `pawn-chat`.
  Die Felder sind jetzt da; die KI kennt sie noch nicht.
- Neue Inszenierungen („Werk im Raum", „Möbel im Raum", Detail/Textur) in
  `generate-staging-shot` und `ai_config.staging_templates`.
- Kunst- und Interior-Vokabular in `classify-term` und den Kuratierungs-Prompts.

**Bewusst nicht gebaut:**
- Eigene Bildslots für Signatur/Rückseite und Maßskizze. Die Mediathek kann
  heute schon mehrere Bilder je Werk — ein eigener Slot wäre eine zweite
  Ablage neben der bestehenden. Das gehört entschieden, nicht nebenbei gebaut.
- Urhebernennung im Kaufbeleg. Der Beleg wird serverseitig erzeugt
  (`_shared/rechnung.ts`) und braucht denselben Deploy.
