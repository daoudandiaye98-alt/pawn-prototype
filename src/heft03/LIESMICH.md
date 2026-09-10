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

**Was in dieser Fassung ANDERS ist als im Prototyp** — bitte beim nächsten Abgleich nicht zurückholen:

1. `app.js` hat am Ende **keine Selbststart-Sicherung** mehr (`if(!globalThis.__pawnBoot)…`). Im Projekt ruft `HeftRoute03.tsx` `startHeft()`; die Sicherung hätte ein zweites Heft mit Beispieldaten danebengestellt. Der Import `demoQuelle` in Zeile 10 bleibt — er ist die Standardquelle.
2. `app.js › go()` öffnet am Ende ein Werk bzw. die Tasche, wenn die Route sie trägt. Vorher tat das nur der Start; eine Navigation zu `/werk/<slug>` mitten in der Sitzung landete auf der Bühne ohne Werk.
3. `app.js › product()` schreibt die Adresse `/werk/<slug>`, das Schließen des Fensters führt zurück auf die Bühne (`replaceState`). Damit stimmen Teilen-Links, Zurück-Taste und die Produktangaben für Suchmaschinen.
4. `app.js` gibt zusätzlich `tascheLeeren(haus)` zurück — nach bezahlter Kasse.
5. `schriften.css` ist neu: das Heft schreibt `Playfair`, `@fontsource` registriert `Playfair Display`. Die Datei gibt denselben Schnitten den kurzen Namen, in 400/500/600 je aufrecht und kursiv.

**Zwei Dinge sind beim Kopieren schon erledigt** (H1 Punkt 2 und 3):

1. `style.css` enthält keine `@font-face`-Regeln mehr. Die Schriften kommen aus `@fontsource/playfair-display` und `@fontsource/inter`; die Familiennamen im Heft heißen `Playfair` und `Inter` — falls `@fontsource` andere Namen registriert, **einen** Alias in `index.css` setzen, nicht das Heft ändern.
2. `dreiD.mjs` importiert hier `three` und `three/examples/jsm/renderers/CSS3DRenderer.js` aus dem npm-Paket (Repo hat `three@0.160`, dieselbe Fassung wie die Vorschau). Keine andere Datei kennt Three.js.

**H1 ist erledigt:** `heft.d.ts` beschreibt die Schnittstellen für die React-Hülle (Ambient-Deklarationen auf `@/heft03/…`; die `.mjs` selbst werden nicht typgeprüft). `npm run test:heft` steht in `package.json` und läuft als eigene Prüfung `heft` in `scripts/verify/verify.sh schnell` und `voll`.

**Das Heft mit eigenen Augen sehen** (ohne Datenbank, mit Zeilen in Datenbankform):

```bash
npx vite --host 127.0.0.1 --port 8080 --strictPort &
PRUEFSTAND_CHROMIUM=$(find /opt/pw-browsers -type f -name chrome | head -1) node tools/heft-sicht.mjs
```

Öffnet `referenz/probe-echt.html` in einem echten Browser und legt 16 Aufnahmen ab. In Teil H sind daran sechs Fehler aufgefallen, die im Quelltext unsichtbar waren. `scripts/verify/sicht.sh` kann das nicht ersetzen: es fotografiert den gebauten Stand, und ohne Netz zur Datenbank bleibt das Heft dort auf dem Ladefeld stehen.

**Regel der Bühne:** Aufgestellt wird nur, was freigestellt ist (`product_dna.heft.cutout_url`). Werke ohne Freistellung erscheinen in Suche, Hausseite und Seitenfenster — nie als Foto auf der Bühne. Deshalb ist die Freistell-Function (H6) Pflicht vor dem Umschalttag.

Alles Weitere: `docs/heft03/AUFTRAG-INTEGRATION.md`.
