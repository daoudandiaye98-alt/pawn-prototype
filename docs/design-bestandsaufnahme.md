# PAWN — Design-Bestandsaufnahme (Teil 24)

**Stand:** August 2026 · **Umfang:** gesamter `src/`-Baum (314 `.ts`/`.tsx`-Dateien, davon 72 Seiten unter `src/pages/`, 123 Komponenten/Feature-Dateien) plus `src/index.css` und `tailwind.config.ts`.
**Methode:** sechs unabhängige, read-only Durchsuchungen (grep/rg-Auszählung mit manueller Stichprobenprüfung gegen False Positives). Keine Datei wurde verändert.
**Zweck:** Grundlage für die Entscheidung, wo die Grundüberarbeitung des Designsystems zuerst ansetzen sollte. Reine Bestandsaufnahme — keine Empfehlung außer in Abschnitt 7.

Alles ist nach Häufigkeit sortiert, nicht alphabetisch. Wo etwas nicht zuverlässig ermittelbar war, steht das explizit dabei statt einer Schätzung.

---

## 1 — Das Fundament: Wie viele Werte sind im Umlauf?

### Abstände (Padding/Margin/Gap)

**205 unterschiedliche Werte, 5.160 Fundstellen insgesamt. 76 davon (37 %) werden nur ein- oder zweimal benutzt.**

Top 20 (von 205):

| Wert | Anzahl |
|---|---|
| `mt-2` | 268 |
| `px-4` | 267 |
| `gap-2` | 241 |
| `py-2` | 234 |
| `py-3` | 210 |
| `mt-4` | 190 |
| `gap-3` | 189 |
| `mt-3` | 188 |
| `px-3` | 182 |
| `mt-1` | 174 |
| `px-6` | 161 |
| `mt-6` | 161 |
| `px-5` | 153 |
| `mx-auto` | 127 |
| `p-6` | 99 |
| `mt-8` | 96 |
| `py-1.5` | 94 |
| `gap-4` | 92 |
| `px-14` | 81 |
| `p-2` | 79 |

Die 76 Einweg-/Zweiweg-Werte (vollständige Liste): `-ml-4, -mt-4, -mt-8, -mx-4, -mx-6, -mx-10, -my-6, -my-10, gap-14, gap-20, gap-24, gap-[3px], gap-x-4, gap-x-10, gap-x-16, gap-y-1, gap-y-2, gap-y-4, m-2, mb-5, mb-14, mb-16, ml-0, ml-0.5, mr-1, mr-1.5, mr-3, mt-0, mt-20, mt-32, mt-auto, mx-0, mx-1, mx-2, mx-3.5, my-0.5, my-5, my-10, p-1.5, p-7, p-14, p-[1px], pb-5, pb-20, pb-28, pl-2.5, pl-7, pl-9, pl-10, pl-14, pl-16, pr-0, pr-1, pr-2.5, pr-3, pt-1, pt-2, pt-5, pt-10, pt-12, pt-20, pt-56, pt-[14%], pt-[68px], pt-[76px], px-7, py-0, py-3.5, py-7, py-48, space-x-4, space-y-0, space-y-12, space-y-20, space-y-24, space-y-40`.

Hinweis: `gap-x-*`/`gap-y-*` stand nicht in der Ursprungsliste, kommen aber real vor (8 Werte, 17 Fundstellen) und sind oben eingerechnet.

### Schriftgrößen

**Feste Tailwind-Größen (`text-*`): 11 Werte, 931 Fundstellen, 0 Einweg-Werte** — die Standard-Skala wird konsistent benutzt.

| Wert | Anzahl |
|---|---|
| `text-sm` | 530 |
| `text-xs` | 217 |
| `text-2xl` | 51 |
| `text-lg` | 36 |
| `text-xl` | 33 |
| `text-base` | 25 |
| `text-3xl` | 22 |
| `text-4xl` | 12 |
| `text-6xl` | 2 |
| `text-5xl` | 2 |
| `text-7xl` | 1 |

**`clamp()`-Werte (fließende Typografie): 48 unterschiedliche Werte, 73 Fundstellen, 36 davon (75 %) nur einmal benutzt.** Das ist ein komplett eigenes, unversioniertes System: 3× rohes CSS in `index.css` (innerhalb der `.t-display-*`-Klassen), 19× `text-[clamp(...)]` als Tailwind-Arbitrary-Value, der Rest (~51) als Inline-`style={{ fontSize: "clamp(...)" }}` verteilt über rund 25 Seiten (u. a. `Widerruf.tsx`, `DesignersIndex.tsx`, `Datenschutz.tsx`, `Ausgabe.tsx`, `Cart.tsx`, `NotFound.tsx`, `Index.tsx`, `Account.tsx`, `DNA.tsx`, `ApplyLanding.tsx`, `Auth.tsx`, `AGB.tsx`, `Impressum.tsx`, `Designers.tsx`, `Checkout.tsx`, `DesignerPage.tsx`, `ProductDetail.tsx`, `Shop.tsx`). Am häufigsten wiederholt: `clamp(2rem,4vw,3.4rem)` (6×), `clamp(1.8rem,4vw,3rem)` (5×), `clamp(2.6rem,7vw,6.4rem)` (4×), `clamp(2.4rem,5vw,3.8rem)` (4×) — jede weitere Überschrift bekommt praktisch ihre eigenen drei Zahlen.

### Zeilenhöhe, Laufweite, Schriftschnitt

**Zeilenhöhe (`leading-*`): 16 Werte, 193 Fundstellen, 9 davon (56 %) nur ein- bis zweimal benutzt.**

| Wert | Anzahl |
|---|---|
| `leading-relaxed` | 76 |
| `leading-none` | 36 |
| `leading-tight` | 34 |
| `leading-snug` | 17 |
| `leading-[1.02]` | 10 |
| `leading-[1.65]` | 6 |
| `leading-[1.05]` | 4 |
| `leading-[1.35]` | 2 |
| `leading-[0.82]` | 2 |
| `leading-[1.75]`, `leading-[1.6]`, `leading-[1.5]`, `leading-[1.15]`, `leading-[0.98]`, `leading-[0.95]`, `leading-[0.92]` | je 1 |

**Laufweite (`tracking-*`): 20 Werte, 750 Fundstellen, 6 davon nur ein- bis zweimal benutzt.** Auffällig: dominiert von Arbitrary-`em`-Werten statt der benannten Tailwind-Skala — ein starkes Indiz, dass die benannte Skala (`tracking-wide/wider/widest`) nie ausgereicht hat.

| Wert | Anzahl |
|---|---|
| `tracking-[0.28em]` | 205 |
| `tracking-[0.22em]` | 115 |
| `tracking-[0.24em]` | 110 |
| `tracking-[0.2em]` | 62 |
| `tracking-wide` | 55 |
| `tracking-[0.32em]` | 44 |
| `tracking-[0.18em]` | 39 |
| `tracking-widest` | 29 |
| `tracking-[0.42em]` | 19 |
| `tracking-[0.3em]` | 12 |
| `tracking-[0.16em]` | 8 |
| `tracking-[0.14em]` | 6 |
| `tracking-tight` | 5 |
| `tracking-wider` | 4 |
| `tracking-normal` | 2 |
| `tracking-[0.35em]` | 2 |
| `tracking-[0.34em]`, `tracking-[0.1em]`, `tracking-[0.06em]`, `tracking-[-0.02em]` | je 1 |

**Schriftschnitt/-gewicht (`font-*`, nur Gewicht): 4 Werte, 172 Fundstellen, 0 Einweg-Werte.** Kein `font-bold`, `font-thin`, `font-black`, `font-extrabold` und keine Arbitrary-Gewichte im Einsatz.

| Wert | Anzahl |
|---|---|
| `font-light` | 77 |
| `font-medium` | 70 |
| `font-semibold` | 15 |
| `font-normal` | 10 |

Zusätzlich 21 rohe `font-weight:`-Deklarationen in `index.css` (innerhalb der `.t-display-*`/`.t-body-*`/`.t-eyebrow`-Skala): `500` (10×), `600` (6×), `400` (5×) — ein zweites, paralleles System ohne Berührung mit den Tailwind-Klassen.

Schriftfamilien (separat gezählt, gleicher Präfix): `font-serif` 228, `font-mono` 20, `font-sans` 9, `font-cormorant` 4, `font-[Playfair_Display]` 1 — auch hier ein Einzelfall (`font-cormorant`), der nirgendwo sonst vorkommt.

### Kantenstärken und Rahmenfarben

**Kantenstärke: 22 Werte, 1.288 Fundstellen, 6 Einweg-Werte.**

| Wert | Anzahl |
|---|---|
| `border` | 660 |
| `border-[1.5px]` | 227 |
| `border-b` | 119 |
| `border-t` | 117 |
| `border-b-[1.5px]` | 34 |
| `border-l-2` | 21 |
| `border-t-[1.5px]` | 16 |
| `border-l-[1.5px]` | 15 |
| `border-0` | 15 |
| `border-r` | 14 |
| `border-l` | 12 |
| `border-y` | 8 |
| `border-2` | 7 |
| `border-b-0` | 6 |
| `border-t-0` | 4 |
| `border-r-[1.5px]` | 4 |
| `border-y-[1.5px]`, `border-r-0`, `border-b-2` | je 2 |
| `border-y-0`, `border-x-[1.5px]`, `border-t-2` | je 1 |

Zusammengezählt über alle Seiten-Varianten kommt die willkürliche `1.5px`-Breite auf **328 Fundstellen** — das ist faktisch eine eigene, nie ins Tailwind-Config übernommene Haarlinien-Breite, neben dem Standard `border` (1px, 660×) und `border-2` (28× über alle Seiten zusammen).

**Rahmenfarben: 72 Werte, 1.405 Fundstellen, 40 davon (56 %) nur ein- bis zweimal benutzt** — die am stärksten zersplitterte Kategorie überhaupt.

| Wert | Anzahl |
|---|---|
| `border-border` | 517 |
| `border-foreground` | 324 |
| `border-black` | 229 |
| `border-[rgba(0,0,0,.18)]` | 62 |
| `border-[#000000]` | 30 |
| `border-black/15` | 27 |
| `border-accent` | 20 |
| `border-[rgba(0,0,0,.28)]` | 18 |
| `border-transparent` | 15 |
| `border-black/20` | 11 |
| `border-destructive` | 8 |
| `border-white/[0.06]` | 7 |
| `border-white/10` | 7 |
| `border-[rgba(0,0,0,.22)]` | 7 |
| `border-[hsl(var(--border-strong))]` | 7 |
| `border-white` | 6 |
| `border-input` | 6 |
| `border-[hsl(var(--border))]` | 6 |

Der Rest verteilt sich auf ~50 weitere, meist ein- bis zweimal benutzte Hex-/rgba-/Opazitäts-Varianten. Allein die `rgba(0,0,0,.NN)`-Familie kommt in **8 verschiedenen Deckkraftstufen** vor (.12 bis .35) statt eines Tokens.

### Bewegungsdauern und Beschleunigungskurven

**Dauer (Tailwind `duration-*`): 6 Werte, 48 Fundstellen, 2 Einweg-Werte.**

| Wert | Anzahl |
|---|---|
| `duration-500` | 17 |
| `duration-300` | 13 |
| `duration-200` | 10 |
| `duration-700` | 6 |
| `duration-150` | 1 |
| `duration-1000` | 1 |

Zusätzlich **10 weitere, komplett getrennte Dauerwerte als rohes CSS** in `index.css` (`.6s`, `.25s`, `.15s`, `.9s`, `.8s`, `.14s`, `2.6s`, `60s`, plus die zwei Tokens `--dur-micro: 250ms` und `--dur-reveal: 600ms`) — Tailwind-Klassen und rohes CSS bilden zwei nicht überlappende Systeme ohne gemeinsame Quelle.

**Beschleunigungskurven: 6 unterschiedliche Werte im aktiven Einsatz, 3 davon nur ein- bis zweimal benutzt** — obwohl die eigene Doku (`src/docs/DESIGN_LANGUAGE.md`) behauptet, es gebe genau eine: `ease-linear` (4×, nur in shadcn-`ui/*`-Primitiven), `ease-in-out` (1× Klasse + 1× in einem `@keyframes`), das rohe CSS-Schlüsselwort `ease` (5×), `var(--ease-pawn)`/`cubic-bezier(0.76,0,0.18,1)` (12×, der eigentliche System-Standard), sowie zwei **weitere, davon unabhängige** hartkodierte Kurven: `cubic-bezier(.22,1,.36,1)` (2×, in `Index.tsx` und `ChatDrawer.tsx`) und `cubic-bezier(.76,0,.18,1)` — dieselbe Kurve wie `--ease-pawn`, aber erneut wörtlich eingetippt statt über die Variable referenziert (`PalaceHeader.tsx`). Zusätzlich weicht die Doku selbst vom Code ab: sie nennt `cubic-bezier(.2,.7,.2,1)` als "die einzige Kurve" — dieser Wert kommt im tatsächlichen CSS nirgendwo vor.

---

## 2 — Farbe: Wo bricht das System?

### Hartkodierte Farbwerte außerhalb `index.css`

**752 Fundstellen in 52 Dateien.** Aufgeschlüsselt:

| Kategorie | Anzahl | Einordnung |
|---|---:|---|
| Reines Schwarz (`#000`, `#000000`, `hsl(0 0% 0%)`, `rgba(0,0,0,x)`) | 453 | Innerhalb der Palette, aber am Token-System vorbei |
| Reines Weiß (`#fff`, `#ffffff`, `hsl(0 0% 100%)`, `rgba(255,255,255,x)`) | 111 | Innerhalb der Palette, aber am Token-System vorbei |
| **Hartkodierte Grautöne `hsl(0 0% N%)` mit N≠0/100** | **150** | **Echter Gesetzesverstoß** |
| **`rgba(241,238,231,x)`** (warmes Off-White/Creme) | **25** | **Echter Gesetzesverstoß** |
| Sonstige echte Fremdfarben (`#646cffaa`, `#61dafbaa`, `#888`, `#808080`, `#111`×6, `#ccc`×3) | 13 | **Echter Gesetzesverstoß** |

Von den 752 Fundstellen sind also **rund 188 echte Verstöße gegen die #000/#FFF-Regel** (Grautöne + Creme + Sonstiges); die übrigen ~564 sind Schwarz/Weiß, aber trotzdem hartkodiert statt über Token.

**Nach Datei, häufigste zuerst** (Auszug — vollständige Liste mit 52 Dateien liegt der Rohauswertung zugrunde):

| Datei | Fundstellen | Art |
|---|---:|---|
| `src/pages/admin/AdminOverview.tsx` | 103 | fast ausschließlich hartkodierte `hsl(0 0% NN%)`-Grautöne für eine "isInk"-Cockpit-Variante |
| `src/pages/DesignerPage.tsx` | 54 | `#FFFFFF`/`#000000` + 17× `rgba(241,238,231,*)` (Creme-Leck) |
| `src/pages/Index.tsx` | 50 | `#FFFFFF`/`#000000` + Creme-Leck |
| `src/pages/ApplyLanding.tsx` | 47 | `#000000`/`#FFFFFF` + `rgba(0,0,0,.NN)` |
| `src/pages/DNA.tsx` | 39 | `#000000`/`#FFFFFF` + Creme-Leck |
| `src/features/campaign/scenes.ts` | 38 | Canvas-Video-Generator, `#000`/`#fff`/`rgba(...)` |
| `src/pages/Cart.tsx` | 31 | `#000000`/`#FFFFFF` |
| `src/pages/Designers.tsx` | 29 | `#000000`/`#FFFFFF` |
| `src/components/pawn/primitives/index.tsx` | 29 | hartkodierte Grautöne für die "isInk"-Variante, **auf denselben Zeilen** neben korrekt eingesetzten Tokens (`hsl(var(--oxblood))` etc.) |
| `src/pages/Checkout.tsx` | 28 | `#000000`/`#FFFFFF` |
| `src/components/palace/ChatDrawer.tsx` | 26 | `#000000`/`#FFFFFF` |
| `src/components/palace/PalaceHeader.tsx` | 25 | `#000000`/`#FFFFFF` + **`#111`×6** als Nav-Link-Farbe im Haupt-Header |
| `src/pages/Shop.tsx` | 24 | `#000000`/`#FFFFFF` |
| `src/components/palace/WorldPage.tsx` | 23 | `#000000`/`#FFFFFF` |
| `src/pages/Auth.tsx` | 21 | `#000000`/`#FFFFFF` |
| `src/components/pawn/ChartPlaceholder.tsx` | 13 | hartkodierte Grautöne (SVG-Platzhalter-Diagramm) |
| … | | 37 weitere Dateien mit 1–11 Fundstellen |

**Der dokumentierte `EditorialImage`-Ausnahmefall — geprüft:** `EditorialImage.tsx` nimmt ein `color`-Boolean, keinen Farbwert — es schaltet nur einen CSS-`grayscale`-Filter um. Keine der 752 Fundstellen stammt aus dieser Ausnahme.

**Ein zweiter, bisher nicht dokumentierter Ausnahmefall gefunden:** Das "Haus-Thema"-System (`src/features/houseTheme/theme.ts` + Edge Function `generate-house-theme`) erlaubt Designer:innen eine völlig freie `farbwelt` (bg/fg/accent/muted) — der System-Prompt der KI sagt wörtlich, Farbwahl sei "völlig frei (auch kräftige Farben, auch Nicht-Schwarz-Weiß) — das ist ausdrücklich gewünscht". Skaliert über die CSS-Klasse `.house-theme`, wirkt nur auf den öffentlichen Bereich eines einzelnen Designers (nicht auf Landing/Checkout/Konto). Fallback-Werte sind `#fff`/`#000`. Das ist ein bewusster, aber bislang unbenannter zweiter Bruch mit der Schwarz-Weiß-Regel.

**Weitere Auffälligkeiten:** `src/App.css` enthält Vite-Boilerplate-Farben (`#646cffaa`, `#61dafbaa`, `#888`) — die Datei wird nirgendwo importiert (toter Code, aber im Repo). `src/features/share/shareKit.ts` nutzt `ctx.fillStyle = "#000"/"#fff"` in Canvas-Code — technisch hartkodiert, aber laut eigenem Kommentar bewusst regelkonform (Canvas kann keine CSS-Variablen lesen).

### Tailwind-Graustufen (`gray-*`, `slate-*`, `zinc-*`, `neutral-*`, `stone-*`)

**Null Fundstellen im gesamten `src/`-Baum**, mehrfach mit unterschiedlichen Mustern (auch Tailwind-v2-Namen wie `coolGray`) geprüft. Das ist Team-Disziplin, keine Config-Sperre: `tailwind.config.ts` erweitert nur `theme.colors`, überschreibt sie nicht — die Standard-Graustufen sind technisch weiter verfügbar.

### Design-Tokens aus `index.css` — benutzt vs. tot

**Aktiv benutzt, absteigend sortiert (Näherungswerte über Klassennamen-Zählung):**

| Token | Tailwind-Klasse(n) | ca. Fundstellen |
|---|---|---:|
| `--foreground` | `border-/text-/bg-foreground` | ~794 zusammen |
| `--muted` (+`-foreground`) | `bg-/text-muted(-foreground)` | ~847 zusammen |
| `--muted-foreground` allein | `text-muted-foreground` | ~734 |
| `--border` | `border`, `border-border` | ~616 |
| `--background` | `bg-/text-background` | ~317 |
| `--accent` (+`-foreground`) | `bg-/text-/border-accent` | ~171 + 43 |
| `--sidebar-*` (7 Variablen) | `sidebar*` | ~123 zusammen |
| `--card` | `bg-card` | ~64 |
| `--destructive` (+`-foreground`) | `bg-/text-destructive` | ~66 + 9 |
| `--primary` (+`-foreground`) | `bg-/text-primary` | ~54 + 35 |
| `--radius` | `rounded-lg/md/sm` (via `calc`) | ~62 |
| `--secondary` (+`-foreground`) | `bg-/text-secondary` | ~27 + 2 |
| `--popover` (+`-foreground`) | `bg-popover` | ~25 + 12 |
| `--ink` | `bg-ink` (Variante in `primitives/index.tsx`) | ~39 |
| `--ring` | `ring`/`ring-ring` | ~23 |
| `--input` | `border-input` | ~11 |
| `--oxblood` | `hsl(var(--oxblood))` | ~8 (nur in `primitives/index.tsx`; selbst definiert als reines Schwarz trotz Namens) |
| `--ease-pawn`, `--dur-micro`, `--dur-reveal` | `.motion-micro`/`.motion-reveal` | ~8 indirekt |
| `--border-strong` | nur als Arbitrary-Value, kein eigener Klassenname im Config | ~7 |
| `--paper` | `bg-paper` | ~10 |
| `--ivory` (nur DEFAULT) | `bg-ivory` | ~3 |
| `--bone` | `bg-bone` | ~2 |
| `--ink-soft` | `bg-ink-soft` | 1 (Grenzfall, praktisch tot) |

**Tote Tokens (definiert, nirgendwo real referenziert):** `--wine`, `--wine-soft`, `--beige`, `--charcoal`, `--gold`, `--gold-sold`, `--ivory-soft`, `--ivory-deep`, `--shadow-editorial`, `--shadow-card`, `--gradient-light`, `--gradient-shadow`, `--gradient-wine`. Das sind **13 tote Tokens** — mehr als die Hälfte der oben aufgeführten "kleinen" Tokens ist inaktiv.

---

## 3 — Die Grundteile: Wie oft wurde dasselbe neu erfunden?

### Knopf (Button)

**5 unterschiedliche Umsetzungen:**

1. **Handgeschriebene `<button>`-Elemente — ~430 Fundstellen in 92 Dateien**, jede mit eigener Kombination aus Kantenstärke, Polsterung, Laufweite und Farbquelle (Token vs. Hex). Von 97 Buttons mit `disabled`-Prop haben nur 28 (~29 %) auch eine sichtbare `disabled:opacity-*`-Klasse. **Keiner der 430** hat einen `focus-visible`-Zustand.
2. **`.palace-btn`-CSS-Klasse — 26 Fundstellen in 13 kundenseitigen Dateien** (`index.css:248-257`). Der intern konsistenteste Button im ganzen System — aber ohne Fokus- und ohne Deaktiviert-Zustand in der CSS-Definition selbst.
3. **shadcn-`Button`-Komponente — nur 15 Dateien importieren sie**, obwohl sie als einzige einen vollständigen Zustands-Satz hat (Fokus-Ring, Deaktiviert-Stil, 5 Varianten, 4 Größen).
4. **PAWN-"Command"-Primitive** (`components/pawn/primitives/index.tsx`) — ein zweiter, expliziter Vereinheitlichungs-Versuch ("Panel, not Card"-Kommentar im selben Modul), 4 Varianten, aber nur **2 Einsatzstellen** im ganzen Repo.
5. **Lokale Helper-Funktionen pro Datei**, z. B. `btnClass()` in `AccountSettings.tsx` — eine eigene, nicht geteilte Kopie, die visuell fast identisch mit `.palace-btn` ist.

### Eingabefeld (Input)

**4 unterschiedliche Umsetzungen:**

1. **Handgeschriebene `<input>`/`<textarea>` — 165 rohe `<input>`-Tags in 41 Dateien**, 73 davon mit eigenem `className`. Nur **3 von 73 (~4 %)** definieren überhaupt einen `focus:`-Zustand.
2. **Drei separate, im `<style>`-Block einer Seite definierte `.inp`/`.input`-Klassen** (`AdminDesigners.tsx`, `StudioBrand.tsx`, `StudioProducts.tsx`) — alle drei mit leicht unterschiedlicher Polsterung, nur eine davon mit Fokus-Zustand.
3. **Lokale `inputClass()`-Funktion** (`AccountSettings.tsx`) — entfernt den Browser-Fokusring, ohne Ersatz.
4. **shadcn-`Input`** — nur 7 Dateien, aber die einzige mit vollständigem Fokus- und Deaktiviert-Zustand.

Fehlerzustände existieren praktisch nirgendwo als Konvention — nur zwei Ad-hoc-Bedingungen in `StudioProducts.tsx`.

### Karte (Card)

**6 unterschiedliche Umsetzungen — die geteilte shadcn-`Card` wird nirgendwo verwendet.**

1. **"Dünne Haarlinie"** (`border border-border bg-white p-...`) — 84 Fundstellen in 14 Dateien.
2. **"Kräftige Haarlinie"** (`border-[1.5px] border-black/foreground bg-white p-6/p-8`) — 36 Fundstellen in 21 Dateien, kunden- und cockpitseitig gleichermaßen. Visuell nur eine dickere Variante von 1., ohne funktionalen Unterschied.
3. **Lokale `Card`-Funktion** in `Account.tsx` — verdeckt den Namen "Card", ohne Export, ohne Bezug zu shadcn.
4. **PAWN-`Panel`-Primitive** (`components/pawn/primitives/index.tsx`) — die reichhaltigste API (4 Oberflächentöne, Header/Eyebrow/Titel/Action-Slots), aber nur **3 Dateien** nutzen sie.
5. **Fünf eigenständige, benannte Karten-Komponenten** (`DesignerCard`, `StatCard`, `ProductCard`, `CustomerGenomeCard`, `GenomeCard`) — `GenomeCard.tsx` tippt dieselbe Klassenkombination wie `Account.tsx`s lokale `Card` unabhängig noch einmal ab.
6. **shadcn-`Card`** — **0 Importe im gesamten Baum.** Toter Code.

### Tabelle

**1 Musterfamilie (rohes HTML), aber 12 gegenseitig inkonsistente Umsetzungen — die shadcn-`Table` wird nirgendwo verwendet.**

16 `<table>`-Tags in 12 Dateien, jede mit eigener Kopfzeilen-, Rand- und Polsterungs-Definition: Schriftgröße reicht von `text-xs` (`AdminAkquise.tsx`) bis zum Standard-`text-sm`, Laufweite von `tracking-[0.18em]` bis `tracking-[0.28em]`, Zellpolsterung von `px-3 py-2` bis `px-6 py-3`, Rahmen von `border-b border-border` bis `border-b-[1.5px] border-black`. `AdminOverview.tsx` ist die einzige Tabelle mit erkennbarer Ladezustands-Behandlung; die übrigen 11 haben keine. Keine der 12 unterstützt Tastatur-Navigation, sortierbare Spalten oder `scope`-Attribute über das native HTML hinaus.

### Dialog/Modal

**3 unterschiedliche Umsetzungen; die geteilte shadcn-`Dialog` ist fast ungenutzt.**

Mindestens **12 eigenständige, handgeschriebene Overlay-Modals** in 11 Dateien — mit uneinheitlichen z-Index-Stufen (`z-50`, `z-[60]`, `z-[70]`, `z-[80]`, `z-[100]`) und Backdrop-Deckkraft (`/40` bis `/70` oder ganz deckend). **Keines** implementiert Escape-Schließen, Fokus-Falle oder `role="dialog"`/`aria-modal` — das leistet ausschließlich die shadcn-`Dialog`, die aber nur in 2 Stellen verwendet wird (`ui/command.tsx` intern und `Apply.tsx`). `Sheet`, `AlertDialog` und `Drawer` aus shadcn haben 1 bzw. 0 bzw. 0 Importe, obwohl mehrere Shells (`AdminShell`, `PortalShell`, `StudioShell`, `PalaceHeader`, `ChatDrawer`, `CopilotDrawer`, `Schwelle`, `SearchOverlay`) eigene mobile Drawer/Overlays von Hand bauen.

### Meldung/Hinweis (Alert/Notice/Toast)

**6 unterschiedliche Umsetzungen, darunter zwei parallel laufende Toast-Systeme gleichzeitig.**

1. **`sonner`** — dominant: 63 Dateien, ~414 `toast.*`-Aufrufe.
2. **shadcn `use-toast`** — ein zweites, unabhängiges Toast-System, nur in `Kontakt.tsx` verwendet. **Beide `<Toaster />` (shadcn) und `<Sonner />` sind gleichzeitig in `App.tsx` eingebunden** — die App fährt zwei konkurrierende Toast-Stacks parallel.
3. **shadcn `Alert`** — **0 Importe**, toter Code (dritte tote shadcn-Komponente neben Card und Table).
4. **"Hinweis"-Infobox-Muster**, mindestens zweimal unabhängig als Inline-Markup nachgebaut (`ErrorBoundary.tsx`, `Versand.tsx`).
5. **Zwei eigenständige, dauerhafte Banner-Komponenten** (`ConsentBanner.tsx`, `ContractV2Banner.tsx`) ohne gemeinsame Basis.
6. **Verstreute Ad-hoc-Fehlerfarben** direkt in Klassenlisten (`StudioCampaigns.tsx`, `StudioOverview.tsx`, `StudioProducts.tsx`, `AccountSettings.tsx`) statt über die (ungenutzte) shadcn-`Alert`-Destructive-Variante.

### Leerzustand (Empty State)

**Mindestens 8 unterschiedliche Umsetzungen, keine geteilt.**

Drei separat definierte, dateilokale `Empty`-Komponenten mit völlig unterschiedlichem Umfang (`AdminOverview.tsx`s minimaler `EmptyRow`, `DNA.tsx`s reichhaltige `EmptyInvitation` mit Chat-Formular, `Account.tsx`s schlichter Titel+Link). Dazu mindestens 6 reine Fließtext-Leerzeilen ohne jede Karte/Icon (`AdminPosting.tsx`, `Checkout.tsx`, `StudioMediathek.tsx`, `StudioProducts.tsx`, `StudioHausseite.tsx` ×2), ein komplett anders aufgebauter voller Leerzustand für den leeren Warenkorb in `Cart.tsx` (der sich mit `Checkout.tsx`s einzeiligem Leerzustand für dasselbe Konzept beißt), sowie ein weiterer bordierter Leerzustand in `StudioOverview.tsx`. Kein `EmptyState`-Baustein existiert in `components/ui/` oder `components/pawn/primitives/`.

**Übergreifend:** Von den drei am häufigsten "wiedererfundenen" Grundteilen abgesehen ist die eigentliche Konstante des Systems der `border-[1.5px] border-black`/`border-foreground`-Haarlinien-Look — 227 direkte Fundstellen über 44 Dateien, faktisch das De-facto-Designtoken der App, aber als literaler String getippt statt als gemeinsame Klasse, weshalb er bei jeder Fundstelle leicht abweichen kann (und tut). Drei shadcn-Bausteine (`Card`, `Table`, `Alert`, dazu `AlertDialog`/`Drawer`) sind komplett tot; eine zweite, selbstständige Design-Bibliothek (`pawn/primitives`) wurde explizit gebaut, um shadcn abzulösen, kam aber selbst nur auf 2–3 Einsatzstellen — drei nicht miteinander versöhnte Vereinheitlichungs-Versuche plus der lange Schwanz aus Inline-Markup.

---

## 4 — Rundungen und Schatten

### Rundungen (`rounded-*` ≠ `rounded-none`, sowie `border-radius` ≠ 0)

**131 echte Verstoß-Fundstellen in 57 Dateien** (zusätzlich 74 korrekte `rounded-none`-Fundstellen). Kein Inline-`style={{borderRadius:...}}` gefunden.

Wichtige Einordnung: `--radius` steht in `index.css` global auf `0`, und `rounded-lg/md/sm` (sowie ihre gerichteten Varianten) sind darüber verrechnet — sie **rendern heute optisch mit 0px**, obwohl sie im Code stehen. Das betrifft **~68 der 131 Fundstellen** (36× `rounded-md`, 20× `rounded-sm`, 6× `rounded-lg`, 3× `rounded-r-md`, 2× `rounded-l-md`, 1× `rounded-tl-sm`) — Systemschulden ohne aktuell sichtbaren Fehler, aber fragil: Würde `--radius` je geändert, würden all diese Stellen unbemerkt rund.

**Wirklich sichtbar rund heute:**

| Wert | Anzahl | Rendert heute? |
|---|---:|---|
| `rounded-full` | 53 | Ja — echte 9999px-Rundung (Avatare, Punkte, Pillen) |
| `rounded` (bare) | 5 | Ja — echte 0.25rem, nicht token-verrechnet |
| `rounded-[2px]` | 2 | Ja |
| `rounded-xl` | 1 | Ja — echte 0.75rem |
| `rounded-t-[10px]` | 1 | Ja |
| `rounded-[inherit]` | 1 | Unklar — hängt vom jeweiligen Elternelement ab |

Von den 131 liegen rund 90 in `components/ui/*` (die shadcn-Bibliothek selbst, nie für dieses Projekt bereinigt). `rounded-full` allein steht in ~24 Dateien, überwiegend Avatare/Status-Punkte/Badges in Admin- und Studio-Seiten (`AdminOverview.tsx` 7×, `StudioShell.tsx` 6×, `AdminPayments.tsx` 3×, `AdminShell.tsx` 3×, plus 15 weitere Dateien mit 1–2×).

**Ein architektonischer Sonderfall:** Das Haus-Thema-System bietet Designer:innen unter `kantenhaerte` explizit die Wahl zwischen `"hart"` (0px, Standard), `"weich"` (6px) und `"rund"` (20px) — verrechnet über `--house-radius` in `index.css`. Anders als die übrigen Fundstellen ist das kein übersehener Einzelfall, sondern eine bewusst eingebaute, datenbankgestützte Ausnahme vom Kantengesetz für den öffentlichen Bereich eines Designers.

### Schatten

**34 weiche/nicht-konforme Schatten-Fundstellen in 28 Dateien**, gegenüber **9 korrekten harten Versatzschatten** (`shadow-hard`/`shadow-hard-sm`/`shadow-[Npx_Npx_0_...]`).

| Wert | Anzahl |
|---|---:|
| `shadow-md` | 10 |
| `shadow-lg` | 9 |
| `shadow-xl` | 4 |
| `shadow-sm` | 3 |
| `shadow` (bare) | 2 |
| `shadow-2xl` | 2 |
| `shadow-[0_0_0_1px_hsl(...)]` | 2 (unklar, s. u.) |
| `shadow-[0_20px_60px_-30px_rgba(...)]` | 1 |
| `shadow-[0_16px_48px_-24px_rgba(...)]` | 1 |

Konzentriert in `components/ui/*` (shadcn, 20 der 34) plus vereinzelt in Admin-Dateien (`AdminDesigners.tsx`, `AdminApplications.tsx`) und Kundenseiten (`Designers.tsx`, `ConsentBanner.tsx` — beide mit echtem, spürbarem Weichzeichner von 48–60px). Zwei Fundstellen in `sidebar.tsx` sind als "unklar" markiert: `shadow-[0_0_0_1px_...]` hat weder Versatz noch Unschärfe und wirkt eher wie ein Rahmen-Ersatz als ein echter Schatten. Zusätzlich definiert `tailwind.config.ts` zwei Token (`shadow-editorial`, `shadow-card`), die korrekt harte Versatzschatten wären — aber nirgendwo als Klasse verwendet werden (tot, siehe Abschnitt 2).

---

## 5 — Seiten-Inventar

72 Seiten unter `src/pages/`. "Feste Farben" zählt nur echte Hex-/rgb-/hsl-Literale, nicht `hsl(var(--token))`. "Mobil geprüft" ist eine Annäherung über `sm:/md:/lg:/xl:`-Präfixe — kein Beweis für tatsächliches Testen, nur ein Indiz für responsives Markup.

| Pfad | Rolle | Zeilen | Leerzustand | Mobil geprüft | Feste Farben |
|---|---|---:|---|---|---|
| src/pages/AGB.tsx | öffentlich | 84 | nein | ja | ja |
| src/pages/Account.tsx | Konto | 438 | ja | ja | nein |
| src/pages/Apply.tsx | öffentlich | 691 | ja | ja | nein |
| src/pages/ApplyLanding.tsx | öffentlich | 405 | nein | ja | ja |
| src/pages/Ausgabe.tsx | öffentlich | 142 | ja | ja | ja |
| src/pages/Auth.tsx | öffentlich | 154 | nein | ja | ja |
| src/pages/Cart.tsx | öffentlich | 191 | ja | ja | ja |
| src/pages/Checkout.tsx | öffentlich | 215 | ja | ja | ja |
| src/pages/DNA.tsx | öffentlich | 398 | nein | ja | ja |
| src/pages/Datenschutz.tsx | öffentlich | 111 | nein | ja | ja |
| src/pages/DesignerPage.tsx | öffentlich | 879 | ja | ja | ja |
| src/pages/Designers.tsx | öffentlich | 146 | ja | ja | ja |
| src/pages/DesignersIndex.tsx | öffentlich | 123 | ja | ja | ja |
| src/pages/Impressum.tsx | öffentlich | 77 | nein | ja | ja |
| src/pages/Index.tsx | öffentlich | 570 | ja | ja | ja |
| src/pages/Kontakt.tsx | öffentlich | 95 | nein | ja | nein |
| src/pages/NotFound.tsx | öffentlich | 99 | nein | **nein** | ja |
| src/pages/OrderConfirmation.tsx | öffentlich | 84 | nein | ja | ja |
| src/pages/Presse.tsx | öffentlich | 100 | nein | ja | nein |
| src/pages/ProductDetail.tsx | öffentlich | 591 | nein | ja | ja |
| src/pages/Shop.tsx | öffentlich | 289 | ja | ja | ja |
| src/pages/Versand.tsx | öffentlich | 36 | nein | ja | ja |
| src/pages/Vision.tsx | öffentlich | 245 | nein | ja | nein |
| src/pages/Widerruf.tsx | öffentlich | 55 | nein | ja | ja |
| src/pages/palace/Interior.tsx | öffentlich | 13 | nein | unklar (Wrapper) | nein |
| src/pages/palace/Kunst.tsx | öffentlich | 13 | nein | unklar (Wrapper) | nein |
| src/pages/palace/Mode.tsx | öffentlich | 13 | nein | unklar (Wrapper) | nein |
| src/pages/palace/Neu.tsx | öffentlich | 72 | nein | ja | ja |
| src/pages/admin/AdminAI.tsx | Cockpit | 402 | nein | ja | nein |
| src/pages/admin/AdminAkquise.tsx | Cockpit | 956 | ja | ja | nein |
| src/pages/admin/AdminAktionen.tsx | Cockpit | 82 | ja | **nein** | nein |
| src/pages/admin/AdminApplications.tsx | Cockpit | 467 | ja | ja | nein |
| src/pages/admin/AdminArchiv.tsx | Cockpit | 236 | ja | ja | nein |
| src/pages/admin/AdminCampaigns.tsx | Cockpit | 149 | ja | **nein** | nein |
| src/pages/admin/AdminContent.tsx | Cockpit | 387 | ja | **nein** | nein |
| src/pages/admin/AdminDNA.tsx | Cockpit | 570 | ja | ja | nein |
| src/pages/admin/AdminDesigners.tsx | Cockpit | 337 | ja | ja | nein |
| src/pages/admin/AdminEditionen.tsx | Cockpit | 158 | ja | **nein** | nein |
| src/pages/admin/AdminJarvis.tsx | Cockpit | 858 | ja | ja | nein |
| src/pages/admin/AdminKI.tsx | Cockpit | 1127 | ja | ja | nein |
| src/pages/admin/AdminMessages.tsx | Cockpit | 135 | ja | ja | nein |
| src/pages/admin/AdminOverview.tsx | Cockpit | 946 | ja | ja | ja |
| src/pages/admin/AdminPayments.tsx | Cockpit | 337 | ja | ja | nein |
| src/pages/admin/AdminPosting.tsx | Cockpit | 194 | ja | ja | nein |
| src/pages/admin/AdminProducts.tsx | Cockpit | 81 | nein | **nein** | nein |
| src/pages/admin/AdminTrends.tsx | Cockpit | 169 | ja | **nein** | nein |
| src/pages/admin/AdminWachstum.tsx | Cockpit | 146 | ja | ja | nein |
| src/pages/admin/AdminWerbung.tsx | Cockpit | 82 | ja | ja | nein |
| src/pages/admin/TranslationWarmup.tsx | Cockpit | 64 | nein | unklar (Widget) | nein |
| src/pages/portal/PortalEditor.tsx | Studio | 115 | nein | ja | nein |
| src/pages/portal/PortalOnboarding.tsx | Studio | 186 | ja | **nein** | nein |
| src/pages/portal/PortalOverview.tsx | Studio | 252 | nein | ja | nein |
| src/pages/studio/StudioAufbau.tsx | Studio | 278 | nein | ja | nein |
| src/pages/studio/StudioBrand.tsx | Studio | 208 | nein | ja | nein |
| src/pages/studio/StudioCampaignNew.tsx | Studio | 1872 | ja | ja | ja |
| src/pages/studio/StudioCampaigns.tsx | Studio | 306 | ja | **nein** | nein |
| src/pages/studio/StudioContentBegleiter.tsx | Studio | 250 | ja | ja | nein |
| src/pages/studio/StudioCopilot.tsx | Studio | 125 | ja | ja | nein |
| src/pages/studio/StudioDNA.tsx | Studio | 207 | ja | ja | nein |
| src/pages/studio/StudioHausseite.tsx | Studio | 458 | ja | ja | nein |
| src/pages/studio/StudioMediathek.tsx | Studio | 304 | ja | ja | nein |
| src/pages/studio/StudioMessages.tsx | Studio | 133 | ja | ja | nein |
| src/pages/studio/StudioOrders.tsx | Studio | 418 | ja | **nein** | nein |
| src/pages/studio/StudioOverview.tsx | Studio | 709 | ja | ja | nein |
| src/pages/studio/StudioPayout.tsx | Studio | 424 | nein | ja | nein |
| src/pages/studio/StudioPlan.tsx | Studio | 286 | nein | ja | ja |
| src/pages/studio/StudioProducts.tsx | Studio | 1230 | ja | ja | nein |
| src/pages/studio/StudioReferrals.tsx | Studio | 113 | ja | **nein** | ja |
| src/pages/studio/StudioSettings.tsx | Studio | 136 | ja | ja | nein |
| src/pages/studio/StudioStueckNeu.tsx | Studio | 394 | ja | ja | nein |
| src/pages/studio/StudioVersand.tsx | Studio | 377 | ja | ja | nein |
| src/pages/studio/StudioVideothek.tsx | Studio | 93 | ja | ja | nein |

**Zusammenfassung:** 28 öffentliche Seiten, 1 Konto-Seite, 22 Studio-Seiten (inkl. `portal/`), 21 Cockpit-Seiten — keine Seite blieb "unklar" bei der Rollen-Zuordnung. **45 von 72 (63 %)** haben einen echten Leerzustand; 27 nicht, überwiegend statische/rechtliche Seiten (AGB, Impressum, Datenschutz, Widerruf, Versand, Kontakt, Presse, Vision, NotFound) sowie einzelne Admin-/Studio-Seiten ohne Listen-UI. **12 Seiten** zeigen keine Breakpoint-Präfixe trotz nicht-trivialem Layout und sind damit vermutlich **nicht mobil geprüft**: `NotFound.tsx`, `AdminAktionen.tsx`, `AdminCampaigns.tsx`, `AdminContent.tsx`, `AdminEditionen.tsx`, `AdminProducts.tsx`, `AdminTrends.tsx`, `PortalOnboarding.tsx`, `StudioCampaigns.tsx`, `StudioOrders.tsx`, `StudioReferrals.tsx` (11 Volltreffer) — plus vier als "unklar" markierte dünne Wrapper/Widgets. **23 Seiten (32 %)** enthalten echte hartkodierte Farbwerte — praktisch durchgängig Schwarz/Weiß/rgba-Schatten auf den öffentlichen Seiten, dazu `AdminOverview.tsx` (hartkodierte Grautöne), `StudioCampaignNew.tsx`, `StudioReferrals.tsx` und `StudioPlan.tsx`. Keine Seite verwendet Tailwind-Graustufen-Klassen.

---

## 6 — Sprache

### i18n (`src/lib/i18n.tsx`) vs. `site_content`/`Editable` vs. fest im Code

**i18n-System:** 90 Wörterbuch-Einträge (De/En), aufgerufen über `useI18n()` an **21 Stellen in 15 Dateien**, mit ~81 tatsächlichen `t(...)`-Aufrufen. Deckt nur einen schmalen Ausschnitt ab: Navigation, Auth, Warenkorb/Checkout, Konto-Einstellungen, Chat-Drawer. **Komplett abwesend** in `src/pages/studio/*`, `src/pages/admin/*`, `src/pages/portal/*`, `src/features/*` und den meisten übrigen `src/pages/*`.

**`site_content`/`Editable`:** 30 direkte `useContentValue`/`useContentValueMeta`-Aufrufe in 6 Dateien, 116 `<Editable>`-Tags in 13 Dateien, 2 `<EditableImage>`-Stellen. Die Registry (`src/lib/contentRegistry.ts`) listet 133 bekannte Schlüssel; ein Live-Scan der JSX findet 103 tatsächlich referenzierte `contentKey`-Literale (die Differenz sind vermutlich berechnete/templated Keys wie `world_${World}_hero_image`, die ein statischer Grep nicht auflösen kann). Konzentriert auf redaktionelle Kundenseiten (Landing, Welten, Designer-Verzeichnis, Bewerben-Landing, DNA, Vision, Shop-Banner) — überschneidet sich kaum mit dem i18n-System (nur 4 Dateien nutzen beides).

**Fest im Code (außerhalb beider Mechanismen) — Top-Dateien nach ungefährer Fundstellenzahl:**

| Rang | Datei | ca. Anzahl |
|---|---|---:|
| 1 | `src/pages/studio/StudioCampaignNew.tsx` | ~56 |
| 2 | `src/pages/studio/StudioProducts.tsx` | ~46 |
| 3 | `src/pages/Apply.tsx` | ~39 |
| 4 | `src/pages/admin/AdminOverview.tsx` | ~38 |
| 5 | `src/pages/studio/StudioOverview.tsx` | ~27 |
| 6 | `src/pages/studio/StudioHausseite.tsx` | ~25 |
| 7 | `src/pages/admin/AdminKI.tsx` | ~24 |
| 8 | `src/pages/admin/AdminJarvis.tsx` | ~24 |
| 9 | `src/pages/ApplyLanding.tsx` | ~23 (gemischt — nutzt `Editable` für Haupttexte) |
| 10 | `src/pages/AGB.tsx` | ~22 (Untergrenze, s. u.) |
| 11 | `src/components/pawn/Begleiter.tsx` | ~20 |
| 12 | `src/pages/studio/StudioAufbau.tsx` | ~19 |
| 13 | `src/pages/studio/StudioPayout.tsx` | ~18 |
| 14 | `src/pages/studio/StudioOrders.tsx` | ~16 |
| 15 | `src/components/palace/AccountSettings.tsx` | ~16 (gemischt) |
| 16 | `src/pages/studio/StudioStueckNeu.tsx` | ~14 |
| 17 | `src/components/palace/DnaChat.tsx` | ~14 |
| 18 | `src/components/pawn/StudioShell.tsx` | ~13 |
| 19 | `src/pages/DNA.tsx` | ~12 (gemischt) |
| 20 | `src/pages/studio/StudioDNA.tsx` | ~11 |

**Wichtiger Sonderfall:** `AGB.tsx` und `Datenschutz.tsx` sind **praktisch zu 100 % fest getippte deutsche Rechtsprosa** (596 bzw. 628 Wörter) ohne jede i18n-/`site_content`-Anbindung — die reine Vorkommenszählung unterschätzt das (lange Absätze mit `<strong>`-Unterbrechungen zählen als wenige, aber sehr lange Textknoten), tatsächlich sind es die größten einsprachigen Textblöcke der App. Eine `LegalTranslationNote`-Komponente auf diesen Seiten weist englischsprachige Leser:innen explizit darauf hin, statt zu übersetzen. **Muster:** praktisch der gesamte Cockpit- und Studio-Bereich (`admin/*`, `studio/*`) läuft zu 100 % auf fest getipptem Deutsch, ohne jeden i18n-Anschluss — ein großer, in sich konsistenter Pool, klar getrennt von den kundenseitigen Seiten mit Teil-Anbindung.

### `site_content`-Schlüssel ohne englische Fassung

**Nicht zuverlässig aus Code/Migrationen allein ermittelbar — mit Begründung:**

Nur 3 SQL-Migrationsdateien enthalten `INSERT INTO public.site_content`, mit zusammen **11 eindeutigen Schlüsseln** (`atelier_feature`, `ausgabe_nummer`, `banner_fallback_quote`, `content_guide.interior.text`, `content_guide.kunst.text`, `content_guide.mode.text`, `footer_lines`, `hero_eyebrow`, `hero_headline`, `hero_subline`, `show_seed_content`) — und **keine einzige Migration setzt jemals `value_en`**. Das ist aber nur die per SQL geseedete Untermenge: `Editable`s `saveContent()` legt Zeilen per Upsert lazy an, sobald ein Admin im Editier-Modus zum ersten Mal einen Text ändert — der Frontend-Registry (`contentRegistry.ts`) listet bereits 133 bekannte Schlüssel, ein JSX-Scan findet 103 tatsächlich referenzierte. Die Vergabe der englischen Fassung passiert ausschließlich live gegen die laufende Datenbank (`AdminContent.tsx`, "Claude vorschlagen"-Knopf) und wird nie in eine Migration geschrieben. **Belastbare Zahl zu "wie viele Schlüssel haben keine englische Fassung" erfordert einen echten `SELECT key, value_en FROM site_content` gegen die Live-Datenbank** — das kann diese rein code-/migrationsbasierte Bestandsaufnahme nicht leisten. Die einzige verlässliche Aussage aus dem Code: die migrationsseitig garantierte Untergrenze ist **11 von 11 Schlüsseln ohne englische Fassung**; die tatsächliche Zahl liegt vermutlich deutlich höher (näher an 103–133), aber das ist eine Vermutung, keine Zählung.

---

## 7 — Urteil

Am saubersten ist das System dort, wo es sich auf einen einzigen, gut durchdachten Mechanismus verlassen kann: Schriftgrößen und Schriftgewicht halten sich strikt an die Standard-Tailwind-Skala (11 bzw. 4 Werte, praktisch keine Einweg-Fälle), die schwarz-weiße Farbwelt wird tatsächlich fast überall eingehalten (von den 752 hartkodierten Farbwerten sind drei Viertel ohnehin Schwarz oder Weiß, nur eben nicht über Token), und keine einzige Stelle im ganzen Baum greift zu Tailwinds eingebauten Graustufen — ein Verbot, das nirgendwo im Code erzwungen wird und trotzdem lückenlos eingehalten wurde. Auch das Seiten-Inventar zeigt ein reiferes Bild als befürchtet: 63 % aller Seiten haben einen echten, durchdachten Leerzustand, und responsive Breakpoints fehlen nur auf einer überschaubaren Minderheit von 11 Seiten, meist unauffälligen Admin-Nebenansichten.

Die größte Uneinheitlichkeit liegt nicht in einem einzelnen Wert, sondern in der Bauweise selbst: Fast jede Grundkomponente wurde mehrfach unabhängig neu erfunden, statt einmal gebaut und geteilt zu werden. 430 handgeschriebene Buttons in 92 Dateien, 165 handgeschriebene Eingabefelder in 41 Dateien, mindestens zwölf eigenständige Modal-Implementierungen mit fünf verschiedenen z-Index-Stufen, zwölf gegenseitig inkonsistente Tabellen und acht verschiedene Leerzustands-Bausteine zeichnen das Bild eines Systems, das drei Mal versucht hat, sich selbst zu vereinheitlichen (shadcn/ui, die `.palace-btn`/`palace-*`-CSS-Klassen, die neuere `pawn/primitives`-Bibliothek), ohne dass sich je eine davon durchgesetzt hätte — shadcn-`Card`, -`Table` und -`Alert` haben schlicht null Verwendungsstellen, während `pawn/primitives` trotz expliziter Ambition ("ein Grammatik für jede Oberfläche") nur zwei bis drei Einsatzstellen erreicht hat. Fokus-, Lade- und Fehlerzustände fehlen praktisch überall dort, wo von Hand statt über eine geteilte Komponente gebaut wurde — das ist zugleich das größte stille Accessibility-Risiko im ganzen System. Am zweitgrößten ist die Zersplitterung bei Rahmenfarben (72 Werte, 56 % Einwegfälle) und Laufweiten (dominiert von neun verschiedenen, nie tokenisierten `em`-Werten) — Bereiche, in denen niemand bewusst experimentiert hat, sondern jede Datei denselben Effekt unabhängig neu vermessen hat.

Drei Eingriffe würden bei geringem Risiko überproportional viel bewirken. Erstens: der `.palace-btn`-CSS-Klasse in `index.css` einen `focus-visible`- und einen `disabled`-Zustand hinzufügen — eine einzige Datei ändern, wovon 26 Einsatzstellen in 13 Dateien sofort profitieren, ohne dass diese Dateien selbst angefasst werden müssen. Zweitens: die rund 188 echten Farbverstöße (Grautöne, das Creme-Leck, `#111`, `#808080`) beseitigen — sie konzentrieren sich auf etwa zehn Dateien, allen voran `AdminOverview.tsx` und `pawn/primitives/index.tsx`, wo bereits korrekte Tokens direkt neben den hartkodierten Werten stehen und der Austausch rein mechanisch ist, ohne optische Überraschung. Drittens: die faktisch schon auf 0 stehenden `rounded-md/sm/lg`-Klassen (ca. 68 Fundstellen, überwiegend in `components/ui/*`, geschätzt 20–25 Dateien) explizit durch `rounded-none` ersetzen — das ändert heute nichts Sichtbares, entfernt aber eine stille Falle, die erst bemerkt würde, wenn `--radius` sich je ändert. Alle drei sind gut abgegrenzt, für sich genommen risikoarm und ließen sich unabhängig voneinander und ohne Rücksprache mit der großen Vereinheitlichungsfrage (Buttons, Karten, Tabellen) sofort umsetzen.
