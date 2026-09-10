# Auftrag „Teil H — Das Heft zieht ein"

**An:** Claude Code im Repo `pawn-prototype` (Arbeitskopie: `work/pawn-prototype`)
**Von:** Daouda, vorbereitet mit Claude (Cowork), 10. September 2026
**Gegenstand:** Der Prototyp „Ausgabe 03" (`outputs/pawn-frontend-v2`, Paket 3.2.0) wird das öffentliche Frontend von pawn.vision und hängt am bestehenden Backend (Lovable Cloud / Supabase `rnakubexbqfgfciynqpt`).

Es gelten `CLAUDE.md` (die sieben Gesetze, Design-Gesetze, harte Regeln), `.claude/rules/00-gesetze.md`, der Skill `deploy-choreografie` und der Subagent `pruefer`. Daouda ist kein Entwickler: Berichte in einfachem Deutsch, jeder Schritt mit Beweis (Befehlsausgabe, Screenshot, Zahl). Vor jedem sichtbaren Merge: **Sicht-Freigabe durch Daouda auf der Vercel-Vorschau** (Regel aus Teil Y).

---

## 0. Lage

**Was da ist.** Der Prototyp ist eine eigenständige Vanilla-JS/Three.js-Studie (12 Module, ~1900 Zeilen, 27 Tests, ohne Build). Er ist in Revision 03 anschlussfähig gemacht worden:

- `app.js` exportiert **`startHeft(optionen)`** — einen Einstieg, der das Heft in eine Seite stellt und `{go, route, state, refresh, stop}` zurückgibt.
- `quelle.mjs` ist der **Port** zur Außenwelt: `demoQuelle()` (Beispieldaten, nichts geht raus) und `supabaseQuelle({client, bild, funktionen})` — spricht über den hereingereichten supabase-js-Client mit genau den Tabellen, RPCs und Edge Functions, die es heute gibt.
- `adapters.mjs` übersetzt **echte Zeilen** (`products`, `designers`, `designer_page_blocks`, `house_themes`, `media_assets`, `curated_collections`, `orders`, `customer_measurements`) in das Heft-Modell — Spaltennamen wörtlich aus `src/integrations/supabase/types.ts`.
- `routen.mjs` übersetzt Heft-Routen ↔ **echte Pfade** (`/mode`, `/haus/:slug/2`, `/werk/:slug`, `/deine-dna/linie`) und kennt die Umzüge alter Adressen.
- `data.mjs › heftFuellen()` baut Sektionen und Bühnen **aus den Häusern**; auf die Bühne kommen nur freigestellte Werke (`buehnenfaehig`); Welten ohne Häuser zeigen einen ehrlichen Leerzustand.
- `probe-echt.html` zeigt das Heft mit Zeilen in Datenbankform (`fixtures/zeilen.mjs`) — so sieht es aus, wenn die Daten echt sind. **Regel der Bühne: Es steht nur, was freigestellt ist** (`product_dna.heft.cutout_url`); alles andere bleibt auf den Seiten. Fotos als Aufsteller gibt es nicht — Daouda hat das ausdrücklich verworfen.
- `docs/INTEGRATION.md` ist der Vertrag; `sql/01–04` sind die Backend-Ergänzungen als Migrationen.

**Was wir über das Backend wissen** (aus `docs/backend-inventar.md` — bitte zuerst lesen, 410 Zeilen, exakt): kein API-Layer, RLS ist die Grenze; `products` hat genau ein `image_url`; Korb lebt nur im Client, `orders.items` ist JSON in Cent; `create-checkout` erlaubt **ein Haus je Kasse** (`mixed_cart`); Anfragen brauchen ein Konto; `pawn-chat` antwortet JSON ohne Streaming und liefert `cards[].href` noch als `/product/<slug>`; `user_memory` hat kein INSERT für Kunden; `page_visits` zählt nur Eingeloggte; `types.ts` ist älter als die letzten Migrationen (`kauf_freigeschaltet` fehlt).

**Wo die Dateien liegen (die erste Frage, die diese Sitzung gestellt hat).** Der Prototyp lebt außerhalb des Repos, auf Daoudas Rechner unter
`C:\Users\dodon\Documents\Codex\2026-09-08\okay-verschaffe-dir-als-erstes-einen-2\outputs\pawn-frontend-v2\`.
Damit keine Sitzung darauf angewiesen ist, **ist der Einzug bereits geschehen**: Code, Tests, Fixtures, SQL, Referenzdateien und alle Bilder liegen seit dem 10. September im Arbeitsverzeichnis des Repos —

```
src/heft03/            21 Dateien + fixtures/ + referenz/ + sql/   (LIESMICH.md erklärt den Ordner)
public/heft/assets/    71 Dateien (Bilder, Filme, cutouts.json)
docs/heft03/           INTEGRATION.md · AUFTRAG-INTEGRATION.md · backend-inventar.md · REVISION-03.md
```

Sie sind **noch nicht committet**. Erster Zug dieser Sitzung:

```bash
git status --short | head            # zeigt die neuen Ordner als untracked
git checkout -b claude/heft03-einzug
git add src/heft03 public/heft docs/heft03
git commit -m "Feature: Das Heft (Ausgabe 03) zieht ins Repo ein"
```

Sind die Ordner **nicht** da, ist diese Sitzung nicht auf Daoudas Rechner (sondern in einer Kopie ohne Arbeitsverzeichnis). Dann gilt: Daouda führt die vier Zeilen oben lokal aus und schiebt den Zweig (`git push -u origin claude/heft03-einzug`); danach `git fetch && git checkout claude/heft03-einzug`. Es gibt keinen dritten Weg — die Dateien existieren nur an diesen zwei Orten.

**Was nicht passiert.** Studio, Admin, Rechtstexte, Stripe-Flüsse, `src/core/seed/*` bleiben unangetastet. Keine neuen Edge Functions werden von uns deployt — Codeänderungen ja, Deploy nur über den Lovable-Agenten (CLAUDE.md).

---

## 1. Teil H1 — Einzug (Code ins Repo)

Ziel: Das Heft baut mit Vite, prüft mit `tsc`, testet mit `node --test` — ohne dass ein Modul umgeschrieben wird.

**Schon erledigt** (beim Kopieren, s. oben):

- Die Dateien liegen an ihrem Platz (`src/heft03/`, `public/heft/assets/`, `docs/heft03/`). `server.mjs`, `vendor/`, `tools/`, `quellbilder/` sind bewusst **nicht** mitgekommen; `index.html`, `boot.mjs`, `probe-echt.html`, `boot-probe.mjs`, `freistellen.py`, `vendor-schriften.css` liegen als Lesestoff unter `src/heft03/referenz/` und werden nicht gebaut.
- `style.css` enthält **keine** `@font-face`-Regeln mehr. Die Schriften kommen aus `@fontsource/playfair-display` und `@fontsource/inter`; das Heft erwartet die Familien `Playfair` und `Inter`. Registriert `@fontsource` andere Namen, wird **ein** Alias in `src/index.css` gesetzt — nicht das Heft geändert.
- `dreiD.mjs` ist die einzige Datei, die Three.js kennt, und importiert im Repo bereits `three` und `three/examples/jsm/renderers/CSS3DRenderer.js` (Repo hat `three@0.160`, dieselbe Fassung wie die Vorschau). Kein Upgrade, keine weitere Änderung an `world.mjs`.

**Zu tun:**

1. `src/heft03/heft.d.ts` schreiben — Signaturen von `startHeft`, `demoQuelle`, `supabaseQuelle`, `heftAusZeilen`, `routeAusPfad`, `pfadAusRoute`, `alleAdressen`, `UMZUEGE` (die Kopfkommentare der Module beschreiben sie vollständig). `allowJs` in `tsconfig.app.json` bleibt, wie es ist: die `.mjs` werden über die `.d.ts` typisiert, nicht mitgeprüft.
2. `package.json`: `"test:heft": "node --test src/heft03/*.test.mjs"` — und dieselbe Zeile in `scripts/verify/verify.sh schnell`. (Vitest versteht die `node:test`-Importe nicht; das ist der kleinere Umbau.)
3. Einmal prüfen, dass Vite die `.mjs` und `style.css` aus `src/heft03/` einbindet (Import in `HeftRoute03.tsx`, H2) und `public/heft/assets/` unverändert ausliefert.

**Beweis H1:** `npm run test:heft` → `27 pass`; `npx tsc --noEmit -p tsconfig.app.json` grün; `npm run build` grün; Bündelgröße vor/nach in Zahlen.

---

## 2. Teil H2 — Die Hülle (`src/heft03/HeftRoute03.tsx`)

Eine React-Komponente für **alle** Heft-Adressen. Sie rendert das DOM-Gerüst aus `index.html` (alles innerhalb `<body>`: Kopfzeile mit Menü, `#stage`, `#reader-layer`, `#editorial`, `#hotspots`, Fußzeile, `#drawer`, `#pawn-chat`, `#begleiter`, `#rotate`, `#loading`, `#mobile-reader`, `#tools-panel`) **einmal** und ruft im `useEffect` `startHeft()` auf. Regeln:

- **Ein Heft, ein DOM.** React rendert das Gerüst und fasst es danach nicht mehr an (`dangerouslySetInnerHTML` für das Gerüst ist in Ordnung; keine React-Kinder innerhalb von `#stage`/`#reader-layer`). Beim Unmount `heft.stop()`.
- **Quelle:**
  ```ts
  supabaseQuelle({
    client: supabase,                              // src/integrations/supabase/client.ts
    bild: (u) => bildVariante(u, {breite: 1280}),  // src/lib/media.ts; Storage-Pfade signieren, sonst durchreichen
    funktionen: {
      anmelden: () => navigate('/auth?next=' + encodeURIComponent(location.pathname)),
      anfrage: ({product, text}) => createCustomRequestThread(...),   // src/features/messages/customRequest.ts
      signal: (art, d) => { if (art==='ansehen') merkeAngesehen(...) ; if (user) record_page_visit(...) }
    },
    adressen: {erfolg: origin + '/order/success?session_id={CHECKOUT_SESSION_ID}', abbruch: origin + '/tasche'}
  })
  ```
- **Adresse:** `adresse:'pfad'`. Das Heft schreibt die History selbst (`pushState`). React Router bleibt Eigentümer der Routen-Tabelle: in einem `useEffect` auf `useLocation()` → `heft.go(routeAusPfad(pathname+search))`, wenn die Adresse nicht schon die des Hefts ist (Vergleich über `pfadAusRoute(heft.route())`). So funktionieren Links aus React (Rechtstexte → zurück ins Heft) und Zurück-Taste gleich.
- **Zustimmung:** `zustimmung: consent==='accepted' ? true : consent==='essential' ? false : null` aus `useConsent()`; `auf.zustimmung(wert)` → `setConsent(wert ? 'accepted' : 'essential')`. **Ein** Zustimmungsdialog: die Sprechblase des Hefts ersetzt `ConsentBanner` auf Heft-Adressen (Banner nur noch auf Nicht-Heft-Seiten).
- **Konto:** `quelle.konto.aktuell()` liest `supabase.auth` + `profiles`. Bei `SIGNED_IN` (`useAuth`) → `heft.refresh()` nach `kontoLaden` — dazu `startHeft` ein zweites Mal **nicht** aufrufen; stattdessen `heft.quelle.konto.aktuell()` und `heft.state.profile` setzen, dann `heft.refresh()`. (Kleiner Zusatz in `app.js`: `kontoLaden` als Teil der Rückgabe exportieren — eine Zeile: `kontoLaden` in das Rückgabeobjekt.)
- **SEO:** `Seo.tsx`/`JsonLd.tsx` je Route aus `heft.route()`: Titel = Sektion bzw. Haus/Werk-Name, Beschreibung = `displays[...].text` bzw. `product.description`. `/werk/:slug` bekommt `Product`-JSON-LD wie bisher `werk.tsx`.
- **Sprache:** Das Heft ist deutsch. `autoTranslate` (DOM-Übersetzung bei `en`) darf auf `#reader-layer` und `#editorial` laufen, **nicht** in `#stage` (Canvas). Bis zur Prüfung: `en` zeigt Heft deutsch mit Sprachumschalter — Daouda entscheidet in H7, ob das reicht.

**Beweis H2:** Vorschau-URL; Screenshots 1440 px von `/`, `/mode`, `/haus/<echtes Haus>/2`, `/deine-dna/richtung`, `/frag-pawn`, `/tasche` mit echten Daten; Konsole ohne Fehler (`scripts/verify/sicht.sh`).

---

## 3. Teil H3 — Adressen (App.tsx · routen.js · vercel.json)

1. `App.tsx`: alle Pfade aus `alleAdressen()` (ohne Slugs: die Muster `/haus/:slug`, `/haus/:slug/:blatt`, `/werk/:slug`) auf `<HeftRoute03/>`. Alte Heft-Routen (`/inhalt`, `/kuratierter-raum`, `/drei-welten`, `/verzeichnis/:seite`, `/ausgabe/001*`) und alte öffentliche Seiten (`/dna`, `/designers`, `/designers/all`, `/boutique`, `/neu`, `/cart`, `/checkout`, `/shop`, `/apply` Landing) werden **Umzüge**, nicht Seiten: `UMZUEGE` aus `routen.mjs` → `<Navigate replace>` in App **und** 301 in `vercel.json`.
2. `routen.js` (Wurzel, Middleware): `ROUTEN` = Ausgabe von `alleAdressen()` plus die Muster; `UMZUEGE` ergänzen. Die Wachen `src/__tests__/routen.spec.ts`, `vercel-routen.spec.ts`, `heft-adressen.spec.ts` müssen grün bleiben — **sie sind der Beweis, nicht die Prosa.**
3. Bleiben als eigene Seiten: `/auth`, `/order/success` (Stripe-Rückkehr; danach `Navigate` → `/konto/3`), `/account` → Umzug auf `/konto` (Rechnungen/Bestellungen liest das Heft selbst, s. H5), `/studio/*`, `/admin/*`, `/apply` (Formular; das Heft zeigt in „Für Designer" die sechs Schritte und ruft am Ende `submit-application`; `/apply` bleibt der Weg für Bewerber mit Link aus einer Einladung — `/einladung/:refCode` bleibt), Rechtstexte, `/kontakt`, `/presse`, `/start` (Künstler-Onboarding), `/einladung/:refCode`.
4. **Löschen** (Gesetz „Weniger ist das Ziel"): `src/heft/*`, `src/features/heft/*`, `src/pages/AusgabeHeft.tsx`, `src/pages/Ausgabe.tsx`, `src/pages/DNA.tsx`, `src/pages/DeineBoutique.tsx`, `src/pages/Designers.tsx`, `src/pages/DesignersIndex.tsx`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `src/pages/Vision.tsx`, `src/pages/ApplyLanding.tsx`, `src/components/palace/{DnaChat,DnaKompass,DnaCover,Stilberater,PasstDas,SearchOverlay,WorldHero,HeroScene,HelixScene,PremiereSection}.tsx` — **erst nachdem** H5 jede ihrer Funktionen im Heft nachweislich hat (Tabelle). Was das Heft übernimmt, wird in `.claude/archiv/` mit einer Zeile „ersetzt durch src/heft03/…" vermerkt. `git rm`, kein Auskommentieren.

**Beweis H3:** `npm test` grün (Routen-Wachen), `curl -I` auf fünf alte Adressen zeigt `301` mit richtigem `Location`, Bündel kleiner als vor H1 (Zahl).

---

## 4. Teil H4 — Backend (Migrationen + Edge Functions, über Lovable)

Reihenfolge nach `deploy-choreografie`: **Migration → Merge → Edge Functions.** Alle vier SQL-Dateien liegen in `outputs/pawn-frontend-v2/sql/` und kommen als Migrationen nach `supabase/migrations/20260910…_heft_*.sql`.

| Nr. | Datei | Was | Warum |
|---|---|---|---|
| 1 | `01_heft_sichten.sql` | Sichten `heft_produkte`, `heft_haeuser` (security_invoker, Spaltenmasken, Grant an anon) | Die Policy `designers public read` gibt anon **alle** Spalten inkl. `stripe_*`. Das Heft liest die Sichten (`supabaseQuelle({sichten:true})`). |
| 2 | `02_kunden_stil.sql` | Tabelle `kunden_stil` (user_id PK, welt, richtung, form, fuer_wen, foto_befund jsonb) + RLS eigene Zeile | Das Bilderquiz hat sonst keinen Serverplatz; `user_memory` erlaubt Kunden kein INSERT. |
| 3 | `03_customer_measurements_raum.sql` | Spalte `raum jsonb` | Interior/Kunst-Maße strukturiert; `room_note` bleibt der Satz. Das Heft fällt ohne Spalte automatisch zurück. |
| 4 | `04_product_dna_heft.sql` | Konvention + Check für `product_dna.heft = {cutout_url, hoehe, notiz}` | Freigestellte Werkfassung fürs Aufstellen; ohne sie kommt das Werk nicht auf die Bühne. |

**`pawn-chat` (Code in `supabase/functions/pawn-chat/index.ts`, Deploy durch Lovable):**

a. `page_context.heft` `{route, seite, stil:{welt,richtung,form}, frag:{was,anlass,rahmen}}` in den Kontext-Hint aufnehmen („«HEFT» Der Kunde steht auf Seite …, seine Linie: …"). Persona/Gesetze unverändert.
b. `cards[].href` → `/werk/<slug>` statt `/product/<slug>`; Navigationsziele `/dna→/deine-dna`, `/cart→/tasche`, `/designers→/haeuser`, `/neu→/ausgewaehlt`, `/designer/<slug>→/haus/<slug>`. (Das Heft versteht heute beides — `chatAntwort()` — aber die alte Form soll sterben.)
c. Neuer `mode:'stilfoto'` (Vision, `gpt-4o` wie heute): Eingabe `image_urls[1]` + `welt`; Ausgabe **nur Beobachtung, nie Bewertung**: Mode `{hautton, unterton, augenfarbe, haarfarbe, farben_passen[], farben_meiden[]}`, Interior `{licht, boden, wandton, vorhandenes[]}`, Kunst `{freie_flaeche, licht, umgebung, farben[]}`. Ohne Konto: Antwort zurückgeben, **nichts speichern** (kein `style_references`, kein `domain_events`-Bild-Signal). Mit Konto: Befund in `kunden_stil.foto_befund` (upsert per service role). Der Upload selbst geht wie bisher über `taste-uploads` (nur eingeloggt) — für Gäste: Bild als `data:`-URL im Body (max 2 MB, serverseitig prüfen) statt Storage.
d. Rate-Limit je IP (40/min) bleibt; Fehlerpfad 200 mit `reply` bleibt.

**Weitere Prüfungen (kein Code, aber Beweis):** `types.ts` neu erzeugen (`mcp__Supabase__generate_typescript_types` bzw. Lovable) und `kauf_freigeschaltet` in `SPALTEN.designers`/`heft_haeuser` aufnehmen, sobald sie live existiert; anon-Lesetest per `curl` mit dem publishable key gegen `heft_produkte`, `designer_page_blocks`, `house_themes`, `media_assets`, `curated_collections`, `contract_versions`, `site_content` (200 + Zeilen) und gegen `orders`, `wishlists`, `customer_measurements`, `kunden_stil` (leer/401).

**Beweis H4:** Migrationsprotokoll aus Lovable, `curl`-Ausgaben, ein Chat-Turn mit `page_context.heft` und `cards[0].href` beginnt mit `/werk/`.

---

## 5. Teil H5 — Funktionsgleichheit (die Tabelle ist der Auftrag)

Jede Zeile wird abgehakt mit **Datei:Zeile im Heft + Beweis**. Stand heute aus Prototyp-Sicht:

| Funktion (alt) | Im Heft | Hängt an | Stand | Zu tun in H5 |
|---|---|---|---|---|
| Landing/Hero (`/`) | Hero-Bühne, drei Welten, Slogan | `displays.hero`, Kuration | fertig | Slogan aus `site_content` (`landing.*`) lesen: `quelle.texte()` ergänzen (Schlüssel → Text), `displays.hero.title/text` überschreiben, wenn gesetzt |
| Drei Welten (`/mode`…) | je Haus eine Bühne, Karussell nach Linie | `heftFuellen`, `kuratiere` | fertig | Reihenfolge der Häuser: `house_number` — Daouda entscheidet, ob `is_featured` vorne steht |
| Verzeichnis/Suche | `/suche` (2 Werke je Doppelseite, Filter) | Client-Suche über geladene Werke | fertig | `bump_product_view` beim Öffnen (drin: `quelle.signal('ansehen')`) |
| Werkseite (`/werk/:slug`) | Seitenfenster: Größe, Passform, Merken, Tasche/Anfrage | `productView`, `passformAssistent`, `purchaseMode` | fertig | `product_dna`-Weltfelder (`weltFelder.ts`) als Detailzeilen anzeigen (`details`, `dna.felder`) — Renderer in `views.mjs › productView` um „Material & Pflege / Maße / Technik" je Welt ergänzen |
| Passform (`computeFit`) | `passformAssistent` (Größenvorschlag aus `measurements`+`sizes`) | `customer_measurements` | teilweise | **`computeFit` aus `src/features/fit/measurements.ts` portieren** (Ease-Bänder eng 0–8/gerade 3–14/weit 8–30, Zeilen-Regex) nach `beratung.mjs`, `groesseAus` ersetzen. Test mit `zeilen.products[0].measurements`. |
| Korb/Kasse | Tasche je Haus, `create-checkout` | `orders`, Stripe | fertig | `/order/success` → `/konto/3`; Toast „Danke" aus `OrderConfirmation` übernehmen; `grant_referral_credit` weiter dort aufrufen |
| Anfrage (Auftragsarbeit etc.) | Formular → `quelle.anfrage` (Login-Pflicht) | `message_threads` | fertig | `useMyRequestThreads` → Konto-Seite 4 „Anfragen" aus `message_threads` (heute statisch): `quelle.konto.anfragen()` analog `bestellungen()` |
| Merkliste | `data-save`, Konto/2 | `wishlists` | fertig | — |
| Konto/Bestellungen | Konto/3 aus `orders` | `orders` | fertig (`bestellZeilen`) | Rechnungs-Link (`invoices`-Bucket, signiert 1 h) je Zeile |
| DNA: Quiz Welt→Richtung→Form | `/deine-dna/*` | `kunden_stil` (neu) | fertig | Merge Gerät→Konto nach Login (drin: `kontoLaden`) |
| DNA: Foto | Upload, Polaroid | `pawn-chat mode:stilfoto` (neu) | **Vorschau** | `quelle.foto(datei, welt)` ergänzen (Upload/ data-URL → Chat-Mode → Befund in `state.foto_befund` → auf Linie-Seite als „PAWN liest: …" anzeigen) |
| DNA: Maße | je Welt | `customer_measurements` (+`raum`) | fertig | — |
| DNA: Prosa-Urteil („Steht mir das?") | regelbasiert (`urteil`) | `generate-dna-voice mode:passt` (JWT) | regelbasiert | eingeloggt zusätzlich Prosa holen: `quelle.urteil(slug)` → unter das Regelurteil |
| DNA: Was PAWN weiß / löschen | `/deine-dna/privacy` | `user_memory`, `style_references`, `domain_events ai.memory_deleted` | Gerät | „Alles löschen" → auch Server: `kunden_stil` delete, `customer_measurements` delete, `user_memory.preferences` leeren (bestehender Code in `DNA.tsx` zeigt wie) |
| Frag PAWN | geführt (3 Chips) + freier Satz → `pawn-chat` | `pawn-chat` | fertig | Bild mitsenden (`bilder[]`): signierte URL nach Upload in `taste-uploads` (eingeloggt) — Gast: data-URL (H4c) |
| Begleiter (Mini-Pawn) | Blasen + Chatfenster | `pawn-chat` | fertig | — |
| Häuser-Verzeichnis / Hausseite | `/haeuser`, `/haus/:slug/1–3` | `designers`, Bausteine, Theme | fertig | Bausteine `banner_*`/`ueberlappend` mit echten `media_assets` sichtprüfen (Fixture hat sie nicht) |
| Vision | drei Doppelseiten | statisch | fertig | Text aus `site_content` `vision_*` (Daoudas eigener Text, Teil R) statt des Heft-Texts — **Daouda entscheidet**, welcher gilt |
| Für Designer / Bewerbung | 6 Schritte → `submit-application` | Edge Function | fertig | `acceptedContractIds` aus `contract_versions` (kind `designer`, `designer_terms`, `effective_to is null`) laden und in Schritt 5 anzeigen; Portfolio-Upload (`designer-applications`-Bucket) wie `Apply.tsx` |
| Konto/Einstellungen | Links, Abmelden | `profiles.consent_*` | teilweise | Consent-Schalter auf `profiles` schreiben (`useAuth().profile.consent`) |
| Seitenbesuche | — | `record_page_visit`/`add_dwell_seconds` | fehlt | in `funktionen.signal` (eingeloggt): Haus- und Werk-Aufrufe zählen, Dwell alle 20 s wie `usePageVisit` |
| Plausible-Ereignisse | — | `lib/analytics.ts` | fehlt | `anfrage_gesendet`, Kasse gestartet, Quiz abgeschlossen |
| Sprache EN | — | `i18n.tsx`/`autoTranslate` | fehlt | s. H2 „Sprache"; Entscheidung H7 |
| Mobil (Hochformat) | Drehhinweis + Lesespalte | — | fertig | Prüfstand 390 px / iPad |

**Beweis H5:** Diese Tabelle mit Datei:Zeile je Zeile in `.claude/stand.json` (Abschnitt `heft03.funktionen`), plus `npm run pruefstand` (4 Seiten × 4 Breiten) — Zahlen vor/nach.

---

## 6. Teil H6 — Bilder und Bühne (Pflicht vor dem Launch)

**Regel:** Auf die Bühne kommt nur, was freigestellt ist. Ein Werk ohne `product_dna.heft.cutout_url` erscheint in Suche, Hausseite und Seitenfenster — aber nicht als Aufsteller. Eine Welt, in der kein Haus ein freigestelltes Werk hat, zeigt die Kulisse ohne Stücke und die Zeile „Die ersten Häuser ziehen ein." Fotokarten als Ersatz gibt es nicht.

1. **Freistellung** ist eine Backend-Aufgabe, keine Browser-Aufgabe (Revision 01). Neue Edge Function `freistellen` (Deploy Lovable): Eingabe `product_id`, holt `image_url`, ruft einen Freistell-Dienst (fal.ai `birefnet` oder Higgsfield `remove_background`, Schlüssel liegen in Lovable), lädt das Ergebnis als transparentes `webp` (max. 1200 px hoch, auf den sichtbaren Bereich beschnitten — wie `tools/freistellen.py`) nach `designer-media/<designer>/heft/<product>.webp`, schreibt `product_dna.heft.cutout_url`. Auslöser: Studio „Werk anlegen/ändern" und ein einmaliger Admin-Lauf über alle veröffentlichten Werke. Kosten je Bild in `ai_action_costs_cents.freistellen` buchen (`book_ai_spend`). **Der Grünfilter der Demo darf nie auf echte Fotos** (zerstört grüne Kleidung).
2. **Studio-Kontrolle**: Vorschau der Freistellung im Studio mit „Passt / Neu freistellen / Nicht auf die Bühne" — ein schlecht freigestelltes Werk ist schlimmer als keins.
3. **Standhöhe**: `product_dna.heft.hoehe` im Studio als Schieber „Wie groß steht es auf der Bühne?" (1,2–3,4), Standard aus `height_cm`.
4. **Hausseiten-Bilder**: `hero_image_url` als Vollbild (Seite 1), `atelier_image_url` als Werkstattseite (Seite 2), Lookbook aus Bausteinen. Ohne Bild: ehrlicher Leerzustand des Hefts, nie Platzhalterfoto.

**Beweis H6:** drei echte Werke mit `cutout_url` auf der Bühne (Screenshot), `ai_actions_log`-Zeilen mit Kosten.

---

## 7. Teil H7 — Prüfung, Freigabe, Übergabe

1. `scripts/verify/verify.sh schnell` vor jedem Commit; `voll` vor dem PR.
2. Subagent `pruefer` liest den Bericht gegen die Wirklichkeit — insbesondere die Tabelle H5.
3. **Sicht-Freigabe durch Daouda** auf der Vercel-Vorschau (Zweig), Checkliste: Eröffnung 5,8 s · Blättern ruhig · ein „DEIN ZUG" je Seite · echte Häuser auf den Bühnen · Tasche → Stripe-Kasse öffnet (Testmodus reicht, kein Kauf) · Quiz speichert nach Login · Frag PAWN antwortet mit echten Werken.
4. Offene Entscheidungen für Daouda (Standard in Klammern): **D1** Vision-Text aus `site_content` oder Heft (`site_content`) · **D2** EN-Fassung jetzt oder nach Launch (nach Launch) · **D3** Reihenfolge der Häuser `house_number` oder `is_featured` zuerst (`house_number`) · **D4** Kopfzeile: Heft-Kopf ersetzt `PublicHeader` auf Heft-Adressen (ja) · **D5** `/account` bleibt als Rechnungs-Archiv oder alles ins Heft (ins Heft, H5).
5. Übergabe: `.claude/stand.json` fortschreiben (offene PRs, Merge-Reihenfolge, worauf Daouda wartet), `.claude/regressionen.json` um drei Zeilen: „Heft startet ohne Konsolenfehler mit echten Daten", „alte Adressen liefern 301", „anon liest keine Stripe-Spalten (heft_haeuser)".

**Fertig heißt:** H1–H6 grün mit Beweisen (H6.1 als eigener PR, aber vor dem Umschalttag — sonst stehen die Bühnen leer), Daoudas Sicht-Freigabe erteilt, Umzüge live, alter Heft-Code gelöscht, Bündel kleiner als heute.

---

## 8. Merge-Choreografie

1. Zweig `claude/heft03-einzug` (H1–H3, H5 ohne Backend-Abhängigkeit). Vorschau → Sicht-Freigabe 1.
2. Migrationen `01–04` durch den Lovable-Agenten anwenden (H4). Erst danach:
3. Merge Zweig 1 → `main` (Lovable synct, Vercel spiegelt).
4. `pawn-chat`-Änderungen (H4 a–d) und `freistellen` (H6.1) deployen lassen; Admin-Lauf über alle veröffentlichten Werke; danach Zweig `claude/heft03-foto` (H5 Foto-Zeile). Sicht-Freigabe 2 — erst jetzt Umschalttag (`/` = Heft).
5. Nach jedem Merge: `.claude/metrik.md` Nachfunde; Fehler → Zeile in `regressionen.json` + Kontrolle in `scripts/verify/`.

---

## 9. Quellen für diese Sitzung (Gesetz 1: was du nicht siehst, existiert nicht)

- Im Repo: `src/heft03/` (Einstieg `app.js › startHeft`, `LIESMICH.md`, `referenz/`, `sql/`, `fixtures/`, Tests), `public/heft/assets/`, `docs/heft03/` (Vertrag `INTEGRATION.md`, Backend-Inventar `backend-inventar.md`, Änderungsstand `REVISION-03.md`).
- Original und laufende Vorschau (nicht im Repo): `outputs/pawn-frontend-v2/`, gestartet mit `node server.mjs` auf Port 4174.
- Repo: `CLAUDE.md`, `.claude/rules/00-gesetze.md`, `routen.js`, `vercel.json`, `src/App.tsx`, `src/lib/{auth,consent,media,publicData}.ts*`, `src/features/{fit,messages,personalization,wishlist}/*`, `src/integrations/supabase/{client,types}.ts`, `supabase/functions/{pawn-chat,create-checkout,submit-application,notify-designer-inquiry}/index.ts`, `supabase/config.toml`.
- Nicht anfassen: `supabase/migrations/*` bestehende Dateien, Rechtstexte, `src/core/seed/*`, Studio/Admin.
