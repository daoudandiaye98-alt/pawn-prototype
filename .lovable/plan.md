## Claude API Key hinterlegen

Speichere den bereitgestellten Anthropic-Key als `ANTHROPIC_API_KEY` in den Projekt-Secrets (via `set_secret`, ohne weiteres Formular — der Wert ist bereits bekannt). Danach steht er allen Edge Functions als Environment-Variable zur Verfügung.

**Wichtiger Sicherheitshinweis:** Du hast den Key im Klartext in den Chat gepostet. Chatverläufe gelten als kompromittiert — bitte **rotiere den Key sofort im Anthropic-Dashboard** (Settings → API Keys → Revoke) und lass mir den neuen Wert dann über das sichere Secret-Formular zukommen (ich kann das auf Wunsch via `update_secret` öffnen).

**Kein Code wird geändert** — die bestehende Function `ai-improve-prompt` prüft bereits nur `OPENAI_API_KEY` und fällt sonst auf den Lovable-Gateway zurück. Wenn du willst, dass Claude aktiv als Provider genutzt wird (z. B. in `pawn-chat`, `studio-ai`, `ai-improve-prompt`), sag Bescheid — das wäre ein separater Zug.

### Schritte
1. `set_secret` mit Name `ANTHROPIC_API_KEY` und dem gelieferten Wert.
2. Bestätigung an dich + Erinnerung zum Rotieren.
