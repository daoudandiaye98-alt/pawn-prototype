# CLAUDE.md — die Karte

## Was PAWN ist
PAWN (pawn.vision) ist ein kuratierter Marktplatz und ein KI-Betriebssystem für
unabhängige Designer aus Mode, Interior und Kunst. Gründer ist Daouda — **kein
Entwickler**: erkläre Änderungen in einfachem Deutsch, keine Fachbegriffe ohne
Erklärung. PAWN ist live und nimmt echte Stripe-Zahlungen entgegen. Regressionen
im Checkout- und Auth-Flow kosten echtes Geld.

## Die sieben Gesetze

1. **Was der Agent nicht sehen kann, existiert nicht.**
   Alles Nötige ist Datei im Repo. Nicht im Kopf, nicht im alten Chat, nicht im
   PR-Kommentar.
2. **Frag nicht, warum er scheitert — frag, welche Fähigkeit fehlt.**
   Ein Fehler wird nie mit einem besseren Prompt beantwortet, sondern mit einer
   Datei, einer Regel oder einer Prüfung.
3. **Mechanische Durchsetzung statt Dokumentation.**
   Was immer gelten muss, wird ein Hook oder ein Test. Prosa ist eine Bitte,
   kein Gesetz.
4. **Gib dem Agenten Augen.**
   Screenshots, Build-Ausgaben, Prüfstandzahlen. Er muss sehen, was er gebaut
   hat — nicht beschreiben, was er glaubt gebaut zu haben.
5. **Eine Karte, kein Handbuch.**
   Diese Datei ist eine Übersicht, kein Kompendium. Ein großes
   Anweisungsdokument macht den Agenten schlechter, nicht besser.
6. **Jede Sitzung fängt bei null an.**
   Ohne Brücke arbeitet jede Schicht ohne Übergabe. Die Brücke ist eine Datei,
   kein Gedächtnis: `.claude/stand.json`.
7. **Beweis vor Bericht.**
   Kein „fertig" ohne Ausgabe eines Befehls, der es zeigt.

Und das Gesetz über den Gesetzen:

> **Weniger ist das Ziel.** Nicht 40 Skills, sondern aus 20 mach 5. Der beste
> Prozess ist der eliminierte. Jede Komponente muss den konkreten, belegten
> Fehler benennen, den sie verhindert — sonst wird sie nicht gebaut.

Und, weil es die teuerste Lücke dieses Projekts war:

> **Ein Agent ist niemals sein eigener Prüfer.** Vor jeder Fertigmeldung läuft
> der Subagent `pruefer`.

## Wo stehen wir?
`.claude/stand.json` — offene PRs, Merge-Reihenfolge, worauf ein Mensch wartet,
nächster Zug. Wird beim Sitzungsstart gelesen und am Ende der Runde
fortgeschrieben. Eine Sitzung, die den Stand nicht fortschreibt, ist nicht fertig.

## Stack und was wo live geht
- Vite + React + TypeScript + Tailwind. Backend: Lovable Cloud (managed
  Supabase, Projekt `rnakubexbqfgfciynqpt`).
- **Frontend:** Push auf `main` → Lovable synct und deployt, Vercel spiegelt auf
  pawn.vision. Frontend-Arbeit über Git ist der günstige Kanal.
- **Edge Functions (`supabase/functions/*`):** Code ändern ja — **Deploy nur
  über den Lovable-Agenten**, das kostet Guthaben. Nach einer Änderung Daouda
  sagen, dass ein Lovable-Deploy nötig ist. Nie selbst deployen.
- **Secrets** (STRIPE_SECRET_KEY, FAL_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
  STRIPE_WEBHOOK_SECRET) liegen nur in Lovable/Supabase. Nie hardcoden, nie in
  `.env`, nie erfragen.

## Die echten Befehle
```bash
npm ci                      # Abhängigkeiten
npm run dev                 # Entwicklungsserver
npm run build               # Produktionsbau — prüft KEINE Typen
npx tsc --noEmit -p tsconfig.app.json   # Typprüfung, separat nötig
npm test                    # Vitest, 54 Tests
npm run lint                # ESLint
npm run pruefstand          # Browser-Messung, 25–30 min

scripts/verify/verify.sh schnell   # Sekunden — Typen, Tests, Regressionen
scripts/verify/verify.sh voll      # Minuten — zusätzlich Bau und Augen
scripts/verify/sicht.sh            # Screenshots nach .claude/sicht/<datum>/
```
Letzte Zeile jedes Verify-Laufs ist maschinenlesbar:
`VERIFY: <bestanden>/<gesamt> · FEHLER: <kurzliste>`

## Design-Gesetze (nicht verhandelbar)
- **Nur #000 und #FFF.** Keine Grautöne als Flächen, keine Farben. Einzige
  Ausnahme: Welt-Kopfbilder über das `color`-Prop auf `EditorialImage`.
- **`border-radius: 0` überall.** Harte Kanten, 1.5px-Linien, harte
  Offset-Schatten (`6px 6px 0 #000`).
- Serifen: **Playfair Display** (600, italic für Akzente). UI: Inter. Kein
  `font-weight: 300`.
- Hover ist **Invertierung** (schwarz ↔ weiß), nie Opacity.
- Wordmark ist die Komponente `PawnWordmark`. Nicht nachbauen.
- Leere Zustände: ehrlich und poetisch („Die ersten Häuser ziehen ein."),
  **nie Fake-Daten**.

## Harte Regeln
1. **Keine Mock- oder Seed-Daten wieder einführen.** `src/core/seed/*` hat leere
   Arrays — so bleibt es. Echte Markennamen sind rechtlich verboten.
2. **RLS-Policies, Trigger und Migrationen in `supabase/`** nur nach
   ausdrücklichem Auftrag anfassen. Nie eine Migration löschen.
3. **Rechtstexte** (`/agb`, `/impressum`, `/datenschutz`, `/widerruf`) nur auf
   ausdrücklichen Wunsch ändern.
4. **`vercel.json` nicht löschen** — darin steht die SPA-Weiterleitung.
5. Auth läuft direkt über `supabase.auth` (`signInWithOAuth` mit
   `redirectTo: window.location.origin`). Nie Lovable-interne `/~oauth`-Pfade.
6. **Rang ist nie käuflich.** Der Rang eines Hauses entsteht aus dem, was es
   baut und verkauft — nie aus dem Plan.

## Das Ritual nach jedem Merge
Findet ein Mensch **nach** einem Merge einen Mangel, gilt der Fehler erst als
erledigt, wenn zusätzlich zur Reparatur eine Zeile in `.claude/regressionen.json`
und eine Kontrolle in `scripts/verify/` steht. Vollständig in
`.claude/rules/00-gesetze.md`.

## Wo das Übrige steht
| Was | Wo |
|---|---|
| Stand zwischen Sitzungen | `.claude/stand.json` |
| Das Ritual, die Kennzahl, das Ausmisten | `.claude/rules/00-gesetze.md` |
| Edge-Function-Regeln (lädt nur bei Bedarf) | `.claude/rules/edge-functions.md` |
| Datenmodell, Pläne, Stripe Connect, Video, Jarvis | Skill `pawn-kontext` |
| Einen Plan zerlegen, bevor gebaut wird | Skill `kreuzverhoer` |
| Migration → Merge → Edge Functions | Skill `deploy-choreografie` |
| Webqualitätsnorm, 25 Launch Gates | Skill `zera-audit` |
| Bericht gegen die Wirklichkeit halten | Subagent `pruefer` |
| Die harten Zusagen, maschinenlesbar | `.claude/regressionen.json` |
| Nachfunde je Merge | `.claude/metrik.md` |
| Der Stand vor diesem Umbau | `.claude/archiv/` |

## Arbeitsweise
- Kleine, fokussierte Commits mit deutschen Messages („Fix: …", „Feature: …").
- Vor jedem Commit muss `scripts/verify/verify.sh schnell` grün sein.
- Mobile-first prüfen: 390 px und iPad. Instagram-Safe-Zones bei allem, was
  Video oder Reel betrifft.
- Bei Unsicherheit über Produktentscheidungen: fragen statt raten. Daouda
  entscheidet, du baust.
