
# PAWN — Situations Pass v1

Von Philosophie zu Beweis. Keine neuen Features, keine neue Architektur. Wir nehmen die bereits existierenden Organe (Event-Log, Reducer, DNA-Selektoren, System-Bus) und machen **acht Momente** im Browser spürbar. Jeder Moment muss die vier Fragen bestehen: *3-Sekunden-Erkennbarkeit, beweisende Oberfläche, systemisches Verhalten, Event/Projektion/Konsequenz*.

Regel für diesen Pass: **PAWN erklärt nicht — PAWN beweist.** Jeder Text, der beschreibt was PAWN tut, wird durch Verhalten ersetzt, das es tut.

---

## Deliverables

### 1. `src/docs/EXPERIENCES.md` — die Verfassung der Momente

Ein einziges Dokument mit ~30 Momenten, jeder in fester Struktur:
- Auslöser (Event)
- Innere Konsequenz (Reducer/Projektion)
- Äußere Konsequenz (sichtbares Verhalten)
- Emotion
- Existenzgrund

Dieser Pass implementiert die ersten **acht**. Der Rest bleibt als Backlog im Dokument.

### 2. Acht implementierte Momente

Jeder Moment ist ein kleiner, chirurgischer Eingriff — keine Rebuilds.

---

## Die acht Momente

### M1 — First Visit *(Home)*
- **Auslöser:** kein `identityId` im lokalen Log, erster Aufruf `/`.
- **Beweis im Browser:** Der Hero ist still. Kein Marketing-Copy-Bombardement. Ein einziger Satz, ein einziger Blick auf einen dunklen Raum. Nach ~1.2s erscheint *eine* Frage — nicht "Sign up", sondern eine Wahl zwischen zwei Bildern (Licht / Schatten). Kein CTA-Button. Die Wahl *ist* der Eintritt.
- **System:** Klick emittiert `dna.signal_recorded` (erstes Signal, gewichtet niedrig). Kein Modal, kein Onboarding-Flow.
- **Warum:** Beweist Regel „PAWN fragt, bevor es spricht".

### M2 — First Choice → Room becomes visible *(Home, sofort nach M1)*
- **Auslöser:** erstes `dna.signal_recorded`.
- **Beweis:** Der Home-Raum re-rendert *ohne Reload*. Ein Produkt-Grid, das vorher nicht existierte, erscheint — sortiert nach dem soeben gesetzten Vektor. Über dem Grid steht eine hairline-Zeile: „*Weil du Schatten gewählt hast.*" — verschwindet nach 6s.
- **System:** `rerankFor(state, identityId)` läuft, `SystemBus` publiziert `recommendation.reranked`.
- **Warum:** Beweist „Der Raum reagiert."

### M3 — First Save → the room remembers *(Shop/Product)*
- **Auslöser:** `product.saved`.
- **Beweis:** Kein Toast. Stattdessen: das ProductCard-Bild atmet einmal (subtle scale 1→1.01→1, 800ms). Beim nächsten Home-Besuch steht oben eine schmale Zeile: „*Zuletzt gespeichert: [Name]. Der Raum hat sich leicht verschoben.*"
- **System:** existierender Event fließt in Wardrobe + DNA. Wir entfernen den bisherigen Sonner-Toast.
- **Warum:** Beweist „PAWN erinnert sich, ohne es zu sagen."

### M4 — Return after time *(jeder erneute Besuch)*
- **Auslöser:** `identityId` existiert, `now - lastSeen > 24h`.
- **Beweis:** Home zeigt beim Wiedereintritt für 2s einen leeren Ivory-Raum mit *einem* Satz: „*Willkommen zurück. Es hat sich etwas verschoben.*" Dann fadet der neue Zustand ein — sichtbar anders als beim letzten Besuch (Reihenfolge, ein neuer Designer oben, eine gedämpfte alte Präferenz).
- **System:** `lastSeen` im lokalen Adapter, Diff-Berechnung auf DNA-Version.
- **Warum:** Beweist Kontinuität ohne Erklärung.

### M5 — Provenance on demand *(Product Detail)*
- **Auslöser:** Nutzer klickt auf den DNA-Match-Prozentwert.
- **Beweis:** Statt Tooltip öffnet sich *inline* eine schmale Spur: die drei konkreten Signale (gespeicherte Teile, gefolgter Designer, verweilte Sekunden), die diese Empfehlung erzeugt haben. Kein Modal.
- **System:** `provenanceFor(recommendationId)` existiert bereits — wir rendern sie nur.
- **Warum:** Beweist „Erklärt sich nur, wenn gefragt."

### M6 — First Mutation *(DNA-Seite)*
- **Auslöser:** `mutation.proposed` (bereits vorhanden über evolution-Engine).
- **Beweis:** Auf `/dna` erscheint der Vorschlag nicht als Card mit Buttons, sondern als *Satz*: „*Deine Struktur scheint sich zu verhärten. Soll ich das übernehmen?*" — zwei Wörter darunter: *annehmen* / *nicht jetzt*. Bei Annahme animiert der Genome-Balken *sichtbar* seinen Wert. Kein Success-Toast.
- **System:** `ratifyMutation` command, `dna.updated` event, Reducer läuft, Balken interpoliert 1.2s.
- **Warum:** Beweist „Mutation ist ein Moment, keine Einstellung."

### M7 — First Purchase → threshold *(Checkout Success)*
- **Auslöser:** `order.placed`.
- **Beweis:** Keine Konfetti-Seite. Ein einziger Frame: das Produkt, klein, zentriert, darunter der Satz „*Es gehört jetzt zu dir.*" — 4 Sekunden lang, dann automatischer Übergang zurück in einen leicht veränderten Home-Raum (das gekaufte Teil verschwindet aus Empfehlungen, verwandte Formsprache steigt).
- **System:** existierender `order.placed`-Reducer + Rerank.
- **Warum:** Beweist „Kauf verändert den Raum, nicht nur die Datenbank."

### M8 — Admin Intervention → visible ripple *(Admin AI)*
- **Auslöser:** Admin ändert eine AI-Policy (`ai.prompt_updated`).
- **Beweis:** Rechts im Admin erscheint eine Live-Zeile: „*Diese Änderung würde 42 aktuelle Empfehlungen verschieben.*" — mit einem *Vorher/Nachher* Diff zweier Beispielprodukte. Erst danach der Speichern-Klick.
- **System:** trockene Simulation via `rerankFor` gegen einen Sample-Identity-Snapshot, kein neuer Event vor Bestätigung.
- **Warum:** Beweist „Entscheidungen haben sichtbare Folgen, bevor sie passieren."

---

## Was *entfernt* wird

Um Beweisen Raum zu geben, verschwindet Erklärung:
- Sonner-Toasts bei Save/Follow (ersetzt durch räumliches Verhalten).
- Beschreibende Marketing-Sätze auf Home, die behaupten was PAWN ist.
- „How it works"-artige Sekundärtexte auf `/dna`.
- Success-Screens ohne Konsequenz.

---

## Technische Notizen (für Lead Engineer)

- **Keine neuen Reducer, keine neuen Event-Typen.** Alle acht Momente nutzen existierende Events aus `src/core/types/events.ts`.
- **Neu:** ein `lastSeen`-Feld im `localStorage`-Adapter (Meta, nicht Event) für M4.
- **Neu:** eine kleine `useRoomShift(reason)`-Hook, die kurzlebige hairline-Zeilen mit auto-dismiss orchestriert (M2, M3, M4). Rein Präsentation.
- **Motion:** ausschließlich existierende Tokens `--ease-pawn`, `--dur-*` aus `src/index.css`. Keine neue Motion-Lib.
- **Interpolation** für Genome-Balken (M6): einfache `requestAnimationFrame`-Rampe, keine Framer-Abhängigkeit.
- **M8-Simulation:** `rerankFor` gegen einen deterministischen Seed-Identity, Diff clientseitig; keine Persistenz bis Bestätigung.
- **Boundaries** bleiben: UI liest nur Selectors/Views, keine Reducer-Interna. Bestehende `boundaries.spec.ts` bleibt grün.

---

## Reihenfolge

1. `src/docs/EXPERIENCES.md` — Struktur + 8 Momente ausgeschrieben, restliche ~22 als Titel-Backlog.
2. M2 + M3 (Home & Save) — höchster erlebbarer Impact, kleinste Fläche.
3. M1 (First Visit) — braucht Home-Restrukturierung, aber nur Hero-Bereich.
4. M4 (Return) — Adapter-Meta + Home-Intro.
5. M5 (Provenance) — nur Product Detail.
6. M6 (Mutation) — nur `/dna`.
7. M7 (Purchase) — Checkout Success.
8. M8 (Admin) — Admin AI.

Kein visueller Redesign-Pass. Kein neues Token. Kein neuer Route. Nur: **die bereits gebaute Realität zum ersten Mal fühlbar machen.**

---

## Erfolgsmessung

Ein Außenstehender öffnet PAWN, tut nichts als klicken, und kann *ohne Erklärung* sagen:
- „Der Raum hat sich verändert, weil ich etwas getan habe."
- „Es weiß etwas über mich, das es vorher nicht wusste."
- „Wenn ich es frage, warum, antwortet es — sonst nicht."

Wenn diese drei Sätze wahr sind, ist der Pass fertig. Alles andere ist noch Philosophie.
