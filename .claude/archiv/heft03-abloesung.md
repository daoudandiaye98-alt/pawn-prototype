# Was das Heft abgelöst hat — Teil H, 10.09.2026

Gelöscht heißt hier: `git rm`, nicht auskommentiert. Wer eine dieser Dateien wiederhaben
will, findet sie vollständig in der Git-Geschichte vor dem Zweig
`claude/heft-frontend-integration-0bjnzf`.

Die Regel dahinter steht in `CLAUDE.md`: *Weniger ist das Ziel.* Eine Funktion, die es
zweimal gibt, läuft auseinander — und die zweite Fassung ist die, die niemand pflegt.

| Gelöscht | Ersetzt durch |
|---|---|
| `src/pages/Index.tsx` | `src/heft03/data.mjs › displays.hero` + `views.mjs` — der Umschlag `/` |
| `src/pages/palace/{Mode,Interior,Kunst}.tsx` | `src/heft03/data.mjs › heftFuellen()` — je Welt eine Bühne pro Haus (`/mode`, `/interior`, `/kunst`) |
| `src/pages/palace/Neu.tsx` | `src/heft03/kuration.mjs › kuratiere('edit')` — `/ausgewaehlt` |
| `src/pages/Shop.tsx` | `src/heft03/extra-views.mjs › searchToolbar` + `presentation.mjs › searchProducts` — `/suche` |
| `src/pages/ProductDetail.tsx` | `src/heft03/views.mjs › productView` (Seitenfenster) — `/werk/:slug` |
| `src/pages/DesignerPage.tsx` | `src/heft03/views.mjs › readView` (Haus-Kapitel, 3 Blätter) — `/haus/:slug` |
| `src/pages/Designers.tsx`, `src/pages/DesignersIndex.tsx` | `src/heft03/views.mjs` — `/haeuser` |
| `src/pages/DNA.tsx` | `src/heft03/beratung.mjs` + `extra-views.mjs` — `/deine-dna/*` |
| `src/pages/DeineBoutique.tsx` | `src/heft03/kuration.mjs` — `/ausgewaehlt` |
| `src/pages/Cart.tsx` | `src/heft03/views.mjs › cartView` — `/tasche`, gruppiert je Haus |
| `src/pages/Checkout.tsx` | `src/heft03/app.js › checkout()` → `create-checkout`, eine Zahlung je Haus |
| `src/pages/Account.tsx` | `src/heft03/extra-views.mjs` — `/konto/1–5` |
| `src/pages/Vision.tsx` | `src/heft03/views.mjs › readView('vision')` — `/vision/1–3` |
| `src/pages/ApplyLanding.tsx` | `src/heft03/views.mjs › readView('fuer-designer')` — `/fuer-designer/1–2`; das Formular bleibt unter `/apply/form` |
| `src/pages/Ausgabe.tsx` | das Heft selbst |
| `src/components/palace/{DnaChat,DnaKompass,DnaCover,DnaBelege}.tsx` | `src/heft03/extra-views.mjs › pawnChat` und die DNA-Doppelseiten |
| `src/components/palace/SearchOverlay.tsx` | `/suche` im Heft; die Kopfzeile verlinkt nur noch dorthin |
| `src/components/palace/{WorldPage,WorldHero,HeroScene,HelixScene,PremiereSection}.tsx` | `src/heft03/world.mjs` — die Bühne |
| `src/features/commerce/CartRecommendations.tsx` | `src/heft03/kuration.mjs` |
| `src/features/commerce/__tests__/korb.ende-zu-ende.spec.tsx` | `src/heft03/tasche.test.mjs` — dieselbe Zusage (Z7), am neuen Ort, einmal rot vorgeführt |

**Was ausdrücklich NICHT gelöscht wurde:** `src/store/cart.tsx` (die Bestellbestätigung
liest ihn weiter), `src/components/palace/{PalaceHeader,PalaceLayout,PasstDas,
ProductServiceSheet,MeasurementsPanel,AccountSettings}.tsx` (tragen die Seiten, die
bleiben), Studio, Admin, Portal, die Rechtstexte, `/auth`, `/apply/form`, `/start`,
`/einladung/:refCode`, `/order/success`, `/kontakt`, `/presse/:slug`, `/preise`.
