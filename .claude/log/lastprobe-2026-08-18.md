# Lastprobe — 2026-08-18

## Phase A · Der Rückkanal

**Frage:** Warum antwortet GitHub mit 403, obwohl `git push` funktioniert?

**Befund: die Anfrage erreicht GitHub nie.** Drei verschiedene Aufrufe — Repo
lesen, Kommentar schreiben, Actions lesen — liefern dieselbe 215-Byte-Antwort:

```
HTTP/1.1 200 Connection Established      ← CONNECT zum Vermittler
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8
Content-Length: 215
Connection: close

{"message":"GitHub access is not enabled for this session. An org admin must
connect the Claude GitHub App for this organization.",
 "documentation_url":"https://docs.anthropic.com/en/docs/claude-code/github-actions"}
```

Was **fehlt**, ist der Beweis: kein `x-github-request-id`, kein
`x-ratelimit-*`, kein `x-accepted-github-permissions`, kein `server: GitHub.com`.
Die `documentation_url` zeigt auf **docs.anthropic.com**.

**Der entscheidende Einzelbeleg:**

| Aufruf | Braucht Anmeldung? | Antwort |
|---|---|---|
| `api.github.com/repos/…` | ja | 403 (Vermittler) |
| `api.github.com/…/issues/180/comments` POST | ja | 403 (Vermittler) |
| `api.github.com/…/actions/runs` | ja | 403 (Vermittler) |
| **`api.github.com/zen`** | **nein** | **403 (Vermittler)** |
| `github.com/daoudandiaye98-alt/pawn-prototype` (Web) | nein | **200** |
| `git ls-remote origin` | ja | **Exit 0, Ref geliefert** |

`/zen` ist öffentlich und braucht keinerlei Token. GitHub beantwortet es jedem
mit 200. Dass auch dort 403 kommt, schließt jede Token-, Berechtigungs- und
Installationsursache aus: **`api.github.com` ist für diese Sitzung pauschal
gesperrt.**

Die Umgebung bestätigt es: `GH_TOKEN=proxy-injected` (14 Zeichen, Platzhalter),
`CCR_AGENT_PROXY_ENABLED=1`, `CCR_TEST_GITPROXY=1`. Git-Protokoll und API
laufen über getrennte Wege; nur der API-Weg ist zu.

**Warum die Diagnosetabelle des Auftrags hier nicht greift.** Sie vermutet zu
schmale App-Berechtigungen. Die Doku widerspricht wörtlich:

> „App installation enables PR webhooks for Auto-fix; **it is not a
> session-level access control**."
> — code.claude.com/docs/en/claude-code-on-the-web

Genau das erklärt das beobachtete Bild: Webhook-Ereignisse kommen weiter an
(App-Installation lebt), die API sperrt (Sitzungszugriff fehlt).

**Behebbar durch:** nur Daouda. Anleitung in `stand.json` unter
`wartet_auf_mensch[0]`. Der Agent kann nichts tun — und darf laut Auftrag an
GitHub-Einstellungen ohnehin nichts verstellen.

**Nicht belegt:** dass die Neuautorisierung den Zugriff tatsächlich
zurückbringt. Das lässt sich erst nach Daoudas Eingriff messen, in einer
**neuen** Sitzung.

**Folge für die Routinen:** `/schedule` prüft dieselbe Zugriffsform und
verlangt `/web-setup`, wenn keine konfiguriert ist. Solange der Rückkanal tot
ist, geht keine Routine scharf.

---

## Phase B · Rot-Beweis für `verify.sh` — 2026-08-19

**Lage geändert:** PR #180 wurde gemergt (`4704394`), danach PR #181 aus dem
179er-Zweig (`0f8834b`). Der Harness liegt auf `main`. Die Lastprobe ist damit
kein Merge-Tor mehr, sondern Nachprüfung an der Produktion.

### Der stärkste Rot-Beweis kam ungebeten

`verify.sh schnell` auf frischem `main`, **ohne jeden eingebauten Fehler**:

```
REGRESSION: 3/6 · FEHLER: Z1,Z5,Z6
VERIFY: 2/3 · FEHLER: regression
Exit: 1
```

Ursache: PR #181 hat die Seiten gelöscht, auf die sich drei Zusagen bezogen —
netto −5526 Zeilen unter `src/`.

| Zusage | Datei | Was daraus wurde |
|---|---|---|
| Z1 | `src/components/palace/PalaceHeader.tsx` | gelöscht, Navigation umgezogen |
| Z5 | `src/pages/ProductDetail.tsx` | gelöscht, `/product/:slug` → `WerkUmzug` |
| Z6 | `src/pages/Shop.tsx` | gelöscht, `/shop` → `Navigate to="/verzeichnis/1"` |

`grep preisSpanne src/` findet nichts mehr — die Boutique mit ihrem Preisfilter
existiert nicht mehr. **Z6 ist nicht gebrochen, sie ist gegenstandslos.**

### Die zwei willentlichen Pfade

**Pfad 1 · Typfehler** (`const KEY: number = "pawn.locale"` in `src/lib/i18n.tsx`)

| | TSC | VERIFY | Exit |
|---|---|---|---|
| vorher | `1/1 · keine` | `2/3` | 1 |
| **rot** | **`0/1 · 3 Typfehler`** | **`1/3 · tsc,regression`** | **1** |
| zurückgenommen | `1/1 · keine` | `2/3` | 1 |

**Pfad 2 · gebrochene Zusage** (deutscher Schlüssel `nav.nurdeutsch` ohne
englische Entsprechung)

| | REGRESSION | Exit |
|---|---|---|
| vorher | `3/6 · Z1,Z5,Z6` | 1 |
| **rot** | **`2/6 · Z1,Z3,Z5,Z6`** — mit dem exakten Schlüssel benannt | **1** |
| zurückgenommen | `3/6 · Z1,Z5,Z6` | 1 |

Der eingebaute Fehler hat die Arbeitskopie nie verlassen:
`git status --porcelain src/` ist danach leer.

**Nebenbefund:** Der fehlende englische Schlüssel schlug gleichzeitig bei `tsc`
und bei Z3 an. Die Typ-Fessel `Record<keyof typeof de, string>` funktioniert —
ein Bruch dieser Zusage ist zugleich ein Typfehler.

### Ein Fehler im Prüfwerkzeug, den `main` aufgedeckt hat

Die drei Kontrollen stürzten mit `Kontrolle abgestuerzt: ENOENT` ab. Das ist die
falsche Auskunft: ein Absturz sagt „die Prüfung ist kaputt", während in Wahrheit
der **Gegenstand** der Zusage verschwunden ist. Zwei sehr verschiedene Lagen,
die verschiedene Antworten verlangen — reparieren gegen entscheiden.

Behoben: verschwundene Gegenstände werden jetzt als solche benannt, mit der
Frage an den Menschen, ob die Zusage an einem neuen Ort weitergilt oder
absichtlich entfallen ist. **Rot bleibt es** — eine Zusage, deren Gegenstand
verschwindet, geht nie stillschweigend durch.
