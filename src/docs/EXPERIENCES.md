# PAWN — Experiences

> Eine Idee existiert erst, wenn ein Nutzer sie erleben kann.
> PAWN erklärt nicht. PAWN beweist.

Dieses Dokument ersetzt Design-Dokumente. Es beschreibt keine Features, sondern **Momente**. Jeder Moment hat dieselbe Struktur:

- **Auslöser** — welcher Event startet den Moment.
- **Innere Konsequenz** — was tut das System (Reducer, Projektion, Rerank).
- **Äußere Konsequenz** — was sieht/hört/spürt der Nutzer.
- **Emotion** — was soll bleiben.
- **Warum** — welche Aussage über PAWN wird bewiesen.

---

## Implementiert (Situations Pass v1)

### M1 — First Visit
- **Auslöser:** kein `identityId`-Signal im lokalen Log, erster Aufruf `/`.
- **Innere Konsequenz:** Kein Onboarding-Flow. `first-visit-done` bleibt `false` bis zur ersten Wahl.
- **Äußere Konsequenz:** Der Hero ist still. Ein Satz, eine Wahl zwischen Licht und Schatten. Kein CTA-Button.
- **Emotion:** *Ich werde nicht empfangen. Ich werde gefragt.*
- **Warum:** PAWN fragt, bevor es spricht.

### M2 — First Choice → the room reacts
- **Auslöser:** Klick auf Licht oder Schatten.
- **Innere Konsequenz:** `proposeMutation` + `ratifyMutation` verschieben den Genom-Vektor. `rerankFor` läuft.
- **Äußere Konsequenz:** Der Raum baut sich vor dem Nutzer neu auf. Eine hairline-Zeile erklärt einmal, warum, und verschwindet.
- **Emotion:** *Meine Wahl hat den Raum verändert.*
- **Warum:** Der Raum reagiert.

### M3 — First Save → the room remembers
- **Auslöser:** `product.saved`.
- **Innere Konsequenz:** Reducer schreibt in Wardrobe, DNA-Selektoren aktualisieren.
- **Äußere Konsequenz:** Kein Toast. Das Bild atmet einmal. Beim nächsten Besuch steht eine schmale Zeile im Home-Header.
- **Emotion:** *Es hat gemerkt, was ich getan habe, ohne es zu sagen.*
- **Warum:** PAWN erinnert sich, ohne zu erklären.

### M4 — Return after time
- **Auslöser:** Home-Aufruf, `now - lastSeen > 2min` (Prototyp-Schwelle).
- **Innere Konsequenz:** Diff auf DNA-Version, `lastSeen` wird aktualisiert.
- **Äußere Konsequenz:** Eine schmale Willkommenszeile: *„Willkommen zurück. Es hat sich etwas verschoben."*
- **Emotion:** *Zeit ist vergangen, und PAWN weiß das.*
- **Warum:** Kontinuität ohne Erklärung.

### M5 — Provenance on demand
- **Auslöser:** Klick auf den DNA-Match-Prozentwert auf Product Detail.
- **Innere Konsequenz:** Kein neuer Event. Nur Rendering der bereits vorhandenen Beitragsachsen.
- **Äußere Konsequenz:** Inline erscheinen die drei Signale, die dieses Match erzeugt haben.
- **Emotion:** *Wenn ich frage, antwortet es. Sonst nicht.*
- **Warum:** Erklärt sich nur, wenn gefragt.

### M6 — First Mutation
- **Auslöser:** `mutation.proposed` (Evolution-Engine oder Prototyp-Seed).
- **Innere Konsequenz:** `ratifyMutation` → `dna.updated`, Genom-Wert wandert.
- **Äußere Konsequenz:** Ein Satz, zwei Wörter (*annehmen* / *nicht jetzt*). Bei Annahme animiert der Balken sichtbar seinen Wert.
- **Emotion:** *Ich habe eine Entscheidung über mich selbst getroffen.*
- **Warum:** Mutation ist ein Moment, keine Einstellung.

### M7 — First Purchase → threshold
- **Auslöser:** `order.placed`.
- **Innere Konsequenz:** Reducer schreibt Order, `rerankFor` läuft.
- **Äußere Konsequenz:** Ein einzelner Frame — Produkt, ein Satz *„Es gehört jetzt zu dir."* — dann automatischer Übergang in einen leicht veränderten Home-Raum.
- **Emotion:** *Etwas hat sich vollzogen. Es war keine Transaktion.*
- **Warum:** Kauf verändert den Raum, nicht nur die Datenbank.

### M8 — Admin intervention → visible ripple
- **Auslöser:** Admin ändert System-Prompt.
- **Innere Konsequenz:** Simulation via `rerankFor`. Kein Event bis zur Bestätigung.
- **Äußere Konsequenz:** Live-Zeile: *„Diese Änderung würde N aktuelle Empfehlungen verschieben."*
- **Emotion:** *Meine Entscheidungen haben sichtbare Folgen, bevor sie passieren.*
- **Warum:** Konsequenzen werden gezeigt, nicht behauptet.

---

## Backlog (nicht implementiert)

- First Follow · First Add to Bag · First Cart Abandon · First Wishlist Return
- Designer Publish · Designer First Sale · Designer First Feedback
- Admin First Suppression · Admin Prompt Rollback
- Suggested Purchase Path · Season Shift · Weekly Dossier
- Silence (Nutzer war 90 Tage weg, DNA dämpft)
- First Regret (Nutzer klickt „nicht ich" auf eine Empfehlung — Regret als First-Class-Event)

Jeder neue Moment folgt der Struktur oben. Kein Moment landet im Produkt, bevor die vier Fragen aus dem Erlebnisprotokoll beantwortet sind.
