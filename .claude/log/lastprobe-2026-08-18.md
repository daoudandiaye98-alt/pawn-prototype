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
