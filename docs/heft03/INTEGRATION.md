# Das Heft anschließen — der Vertrag

Stand: 10. September 2026, Revision 03 („Anschlussfähig"). Gilt für den Prototyp `pawn-frontend-v2` (Ausgabe 03) und das echte Projekt `pawn-prototype` (Vite + React + Supabase `rnakubexbqfgfciynqpt`).

Dieses Dokument sagt, **was das Heft von außen braucht und was es nach außen gibt**. Es ersetzt `FUNKTIONEN-UND-ANBINDUNG.md` in allen Punkten, die dort noch „später" hießen.

## 1. Grundsatz: Das Heft ist ein Modul, keine Seite

Das Heft läuft als **ein** ES-Modul mit **einem** Einstieg:

```js
import {startHeft} from './heft/app.js';
import {supabaseQuelle} from './heft/quelle.mjs';

const heft = await startHeft({
  quelle: supabaseQuelle({client: supabase, bild: signiereMedia, funktionen: {anmelden, anfrage, signal}}),
  adresse: 'pfad',          // echte Pfade (/mode, /haus/lind/2) statt #/mode/1
  basis: '',                // Präfix, falls das Heft nicht unter / liegt
  auf: {navigiert(route){…}, kauf(antwort){…}, anfrage(ereignis){…}, fehler(e){…}}
});
// heft.go(route) · heft.route() · heft.state · heft.refresh() · heft.stop()
```

Regeln, die aus dem Bewegungsvertrag folgen:

- **Eine Zustandsmaschine.** `model.mjs › Magazine` besitzt Bilder, Seiten und Kamera. React darf Routen setzen (`heft.go`) und Zustand lesen (`heft.route()`, `heft.state`), aber keine eigenen Seitentimer, keine zweite Animation.
- **Das Heft besitzt seinen DOM.** Alles unter `#stage`, `#reader-layer`, `#editorial`, `#drawer`, `#pawn-chat`, `#begleiter`, `#mobile-reader`, `#rotate`, `#loading` gehört dem Heft. React rendert die Hülle (`<header>`, Fußzeile, Rechtstexte) und den Wurzelknoten; es greift nie in den CSS3D-Baum.
- **Ein Client.** Das Heft bekommt den vorhandenen supabase-js-Client hereingereicht. Kein zweiter Client, keine Schlüssel im Heft.

## 2. Die Quelle (`quelle.mjs`)

| Methode | Erwartet | Gibt | Woran sie im Backend hängt |
|---|---|---|---|
| `heft()` | — | `{products, houses, media, kuration}` | `products`, `designers`, `designer_page_blocks`, `house_themes`, `media_assets`, `curated_collections`+`collection_items` — nur die Spalten aus `SPALTEN` |
| `chat({messages, bilder, kontext, session_id})` | Heft-Kontext `{route, seite, stil, frag, product_slug}` | `{reply, treffer:[slug], action, session_id}` oder `null` (Heft antwortet regelbasiert) | Edge Function `pawn-chat` |
| `kasse({cart, products, email, locale})` | Warenkorb **eines** Hauses | `{url}` zum Weiterleiten oder `{fehler, fehlt, text}` | Edge Function `create-checkout` |
| `anfrage({product, text, kontakt})` | — | `{ok, thread_id}` · `{anmelden:true}` ohne Konto | `message_threads` + `messages` + `notify-designer-inquiry` |
| `bewerbung(werte)` | Felder von `submit-application` | `{ok, application_id, needs_email_confirmation}` | Edge Function `submit-application` |
| `stil.laden()/speichern(stil, foto, fuerWen)` | Quiz-Ergebnis | Zeile / `{ok}` | **neu:** Tabelle `kunden_stil` (sql/02) |
| `masse.laden()/speichern(zeile)` | `massZeile()`-Ausgabe | Zeile / `{ok}` | `customer_measurements` (+ `raum`, sql/03) |
| `merkliste.laden()/setzen(id, an)` | Produkt-Id | `[ids]` / `{ok}` | `wishlists` |
| `signal(art, daten)` | `ansehen`/`merken`/`quiz`/`kaufen` | — | RPC `bump_product_view`; Sitzungsspur über `funktionen.signal` |
| `konto.aktuell()/anmelden()/abmelden()` | — | `{id, name, email, member_number}` | `supabase.auth`, `profiles` |
| `bild(url)` | Storage-Pfad oder URL | ladbare Adresse | `lib/media.ts › signiereMedia`, `bildVariante` |

Verhalten ohne Konto: `stil`, `masse`, `merkliste` liefern `null`/`{anmelden:true}`. Das Heft speichert dann im Gerätegedächtnis (`store.mjs`, nur mit Zustimmung) und trägt es nach dem Anmelden hoch (`kontoLaden()` mischt Server über Gerät).

## 3. Das Heft-Modell (was `adapters.mjs` aus Zeilen macht)

**Produkt** `{id, slug, name, house, world:'mode'|'interior'|'kunst', price, image, cutout|null, material, description, note, sizes[], stockBySize, inventory_mode, stock_quantity, kind:'produkt'|'auftragsarbeit'|'live_portrait'|'massanfertigung', lead, measurements, dna:{materials,silhouette,colors,mood,tags,felder}, stage:{h,lift}, details, verkaufsbereit}`

- `kind` kommt aus `product_dna.kind`; die drei Anfrage-Typen haben keinen Warenkorb (`purchaseMode → 'inquiry'`).
- `image` ist `image_url`; `cutout` ist `product_dna.heft.cutout_url` (freigestellte Fassung). **Auf die Bühne kommt nur, was freigestellt ist** (`buehnenfaehig`). Ohne `cutout` bleibt das Werk auf den Seiten (Suche, Haus, Seitenfenster) — nie als Fotokarte auf der Bühne.
- `stage.h` aus `product_dna.heft.hoehe`, sonst `height_cm/60` (1,2–3,4), sonst Weltstandard.
- Sichtbar ist nur: `status='published'`, Name, Bild, Preis > 0 (oder Anfrage-Typ), Haus aktiv **und** `published=true`.

**Haus** `{slug, name, number, world, location, title, intro, manifesto, quote, quoteRole, image, portrait, work, workCaption, lookbook[], products[], blocks[], archetyp, theme, color, published, verkaufsbereit, plan}`

- `world` aus `designers.tags` („Mode"/„Interior"/„Kunst"), sonst aus der Mehrheit der Werke.
- `blocks` nur wenn `page_published_at` gesetzt (wie die RLS). Kinds 1:1: `auftakt, editorial_text, zitat, produktreihe, lookbook_streifen, banner_seitlich, banner_vollbreite, ueberlappend`.
- `theme` aus `house_themes` (`farbwelt.{bg,fg,accent,muted}`, `typografie`, `kantenhaerte` → Bogen/Galerie). Ohne Theme: Archetyp-Farbe.

**Bühnen** entstehen aus den Häusern (`data.mjs › heftFuellen`): je Welt eine Sektion, je Haus eine liegende Bühne (`displayAusHaus`), Welt ohne Häuser → ehrlicher Leerzustand („Die ersten Häuser ziehen ein."). Hero und „Ausgewählt für dich" bleiben; die redaktionelle Reihe (`curated_collections`) hat Vorrang vor der Regel-Kuration.

## 4. Adressen (`routen.mjs`)

| Heft | Pfad | Hinweis |
|---|---|---|
| Hero / Ausgewählt | `/` · `/ausgewaehlt` | |
| Welten | `/mode`, `/mode/2`, `/interior`, `/kunst` | Nummer = Bühne der Welt |
| Häuser-Verzeichnis | `/haeuser`, `/haeuser/2…4` | |
| Haus | `/haus/:slug`, `/haus/:slug/2`, `/haus/:slug/3` | |
| Werk | `/werk/:slug` | öffnet das Werk über seiner Welt-Bühne |
| DNA | `/deine-dna`, `/deine-dna/welt|richtung|form|linie|foto|massband|privacy` | Namen, keine Nummern |
| Frag PAWN · Vision · Für Designer | `/frag-pawn`, `/vision/1…3`, `/fuer-designer/1…2` | |
| Suche · Konto · Tasche | `/suche?q=&world=&house=&max=&sort=&available=`, `/konto/1…5`, `/tasche` | |

Umzüge (`UMZUEGE`, als 301 in `vercel.json`): `/dna→/deine-dna`, `/designers→/haeuser`, `/boutique|/neu→/ausgewaehlt`, `/cart→/tasche`, `/account→/konto`, `/shop|/verzeichnis→/suche`, `/apply→/fuer-designer/2`, `/inhalt→/`, `/kuratierter-raum→/vision`, `/drei-welten→/haeuser`. `alleAdressen()` liefert die vollständige Liste für `routen.js`/Tests.

## 5. Was das Backend zusätzlich braucht (sql/ und Edge Functions)

Pflicht für Funktionsgleichheit:

1. **`kunden_stil`** (sql/02) — Quiz-Ergebnis je Konto: `welt, richtung, form, fuer_wen, foto_befund jsonb, quelle`. RLS: eigene Zeile lesen/schreiben. Ohne diese Tabelle bleibt das Quiz nur im Gerät.
2. **`customer_measurements.raum jsonb`** (sql/03) — Interior/Kunst-Maße (`wand, hoehe, flaeche, licht, abstand`) strukturiert statt als `room_note`-Text.
3. **Sichten `heft_produkte`, `heft_haeuser`** (sql/01) — Spaltenmasken für anon; schließt die Stripe-Spalten-Lücke der `designers`-Policy. Das Heft liest die Sichten, sobald sie existieren (`SPALTEN` bleiben gleich).
4. **`pawn-chat`**: `page_context.heft` (Quiz-Stand, Seite) in den Kontext-Hint aufnehmen; `cards[].href` auf `/werk/<slug>` umstellen; neuer `mode:'stilfoto'` mit Schema je Welt (Mode `{hautton, unterton, augenfarbe, haarfarbe, farben_passen[], farben_meiden[]}`, Interior `{licht, boden, wandton, vorhandenes[]}`, Kunst `{freie_flaeche, licht, umgebung, farben[]}`) — Beobachtung, keine Bewertung; nur Analyse, kein Speichern ohne Konto.

Pflicht vor dem Launch (Bühne):

5. `product_dna.heft` = `{cutout_url, hoehe, notiz}` — per Freistellungs-Function beim Upload erzeugt (fal.ai/Higgsfield `remove_background`) oder vom Studio gepflegt. **Ohne Freistellung bleibt die Bühne leer** — deshalb ist die Function vor dem Launch Pflicht (Auftrag H6).
6. `merge-session` um `kunden_stil`/Merkliste des Geräts ergänzen — heute mischt das Heft clientseitig nach dem Login.

## 6. Prüfen

- `node --test model.test.mjs edition3.test.mjs anschluss.test.mjs` — 27 Tests, ohne Browser.
- `probe-echt.html` — das Heft mit Zeilen in Datenbankform (`fixtures/zeilen.mjs`): erzeugte Bühnen (nur freigestellte Werke stehen), Chat-/Kasse-/Anfrage-Antworten wie vom Backend.
- `index.html` — die Vorschau mit Beispieldaten, unverändert.
