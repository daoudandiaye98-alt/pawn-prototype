# src/heft03 — das Heft „Ausgabe 03"

Das ist der Prototyp aus `outputs/pawn-frontend-v2`, kopiert an seinen Platz im Projekt. Er ist **kein** Entwurf mehr, sondern das öffentliche Frontend: ein ES-Modul mit einem Einstieg.

```js
import {startHeft} from '@/heft03/app.js';
import {supabaseQuelle} from '@/heft03/quelle.mjs';

const heft = await startHeft({
  quelle: supabaseQuelle({client: supabase, bild: bildVariante, funktionen: {...}}),
  adresse: 'pfad',
  assets: '/heft/assets/',
});
// heft.go(route) · heft.route() · heft.state · heft.refresh() · heft.kontoLaden() · heft.stop()
```

**Was wo liegt**

| Ordner | Inhalt |
|---|---|
| `src/heft03/*.mjs`, `app.js`, `style.css` | das Heft. `quelle.mjs` = Port nach außen, `adapters.mjs` = Supabase-Zeilen → Heft-Modell, `routen.mjs` = Route ↔ Pfad, `dreiD.mjs` = die einzige Stelle, die Three.js importiert |
| `src/heft03/*.test.mjs` | 27 Tests, laufen mit `node --test src/heft03/*.test.mjs` (kein Browser nötig) |
| `src/heft03/fixtures/zeilen.mjs` | Beispielzeilen in der Form der echten Tabellen |
| `src/heft03/sql/01–04` | die vier Backend-Ergänzungen — als Migrationen nach `supabase/migrations/` übernehmen, **nicht** von Hand im Dashboard ausführen |
| `src/heft03/referenz/` | wird nicht gebaut: `index.html` ist das DOM-Gerüst, das `HeftRoute03.tsx` rendern muss; `boot.mjs` zeigt den Aufruf; `probe-echt.html` + `boot-probe.mjs` zeigen das Heft mit Datenbank-Zeilen; `freistellen.py` ist die Vorlage für die Freistell-Function (H6); `vendor-schriften.css` nennt die vier Schnitte |
| `public/heft/assets/` | Bilder, Filme, `cutouts.json` |
| `docs/heft03/` | `INTEGRATION.md` (Vertrag), `AUFTRAG-INTEGRATION.md` (Auftrag Teil H), `backend-inventar.md` (Ist-Zustand des Backends), `REVISION-03.md` (was sich zuletzt geändert hat) |

**Zwei Dinge sind beim Kopieren schon erledigt** (H1 Punkt 2 und 3):

1. `style.css` enthält keine `@font-face`-Regeln mehr. Die Schriften kommen aus `@fontsource/playfair-display` und `@fontsource/inter`; die Familiennamen im Heft heißen `Playfair` und `Inter` — falls `@fontsource` andere Namen registriert, **einen** Alias in `index.css` setzen, nicht das Heft ändern.
2. `dreiD.mjs` importiert hier `three` und `three/examples/jsm/renderers/CSS3DRenderer.js` aus dem npm-Paket (Repo hat `three@0.160`, dieselbe Fassung wie die Vorschau). Keine andere Datei kennt Three.js.

**Offen aus H1:** `heft.d.ts` schreiben, `npm run test:heft` in `package.json` und in `scripts/verify/verify.sh schnell` eintragen.

**Regel der Bühne:** Aufgestellt wird nur, was freigestellt ist (`product_dna.heft.cutout_url`). Werke ohne Freistellung erscheinen in Suche, Hausseite und Seitenfenster — nie als Foto auf der Bühne. Deshalb ist die Freistell-Function (H6) Pflicht vor dem Umschalttag.

Alles Weitere: `docs/heft03/AUFTRAG-INTEGRATION.md`.
