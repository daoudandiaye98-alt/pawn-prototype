## Wie der Akquise-Rhythmus heute läuft (geprüft in der Datenbank)

Feste Zeitpläne, jeden Tag (UTC):

```text
22:00  Jagd            Jarvis startet Apify-Läufe auf Instagram (3 Läufe/Tag, je 50 Konten)
23:30  Abholen         Ergebnisse werden als Leads importiert
01:00  Abholen         zweiter Import-Lauf
01:30  Prüfen          bis 20 Leads werden per Bild-Analyse bewertet (Score, ab 60 = qualifiziert)
01:45  Kontaktsuche    E-Mail-Adressen über Website/Impressum finden
02:15  Verfassen       Erstnachricht wird für bis zu 10 Leads geschrieben
04:45  Versand         bis 10 E-Mails am Tag (Follow-up nach 5 Tagen, max. 2 Berührungen)
Mo 05:30 Lernen        schwache Suchbegriffe werden aussortiert, starke höher gewichtet
```

Wege: Instagram-Hashtags (17 aktive Begriffe über Mode/Interior/Kunst) plus Nachbarschafts-Konten. Kontaktweg: E-Mail, wenn eine Adresse gefunden wurde, sonst DM (DM bleibt bewusst manuell). Aktueller Stand: 50 neue, 24 qualifizierte, 20 aussortierte Leads — bei **keinem** ist bisher eine E-Mail-Adresse gefunden worden, deshalb ist noch nichts rausgegangen.

## Zwei Lücken, die dein Wunsch aufdeckt

1. Dein „Ja/Nein" im Prüf-Stapel wird gespeichert, aber der Versand-Lauf ignoriert es — er nimmt jeden qualifizierten Lead mit Entwurf. Dein Ja löst also nichts aus.
2. Die Erstnachricht wird jedes Mal frei formuliert. Du willst eine **von dir festgelegte** Vorlage, DE oder EN je nach Konto.

## Plan

**1. Deine Vorlagen werden die Quelle der Wahrheit**
Neues Feld in der Akquise-Konfiguration: `template_de` und `template_en`. Wenn gefüllt, schreibt Jarvis nur noch den persönlichen Einstiegssatz (`<personal_line>`) und setzt ihn in deine Vorlage ein — Rest wortgleich. Sprachwahl bleibt automatisch: Bio eindeutig englisch → EN, sonst DE.

**2. Editor im Admin (`/admin/akquise`)**
Neuer Block „Erstnachricht" mit zwei Textfeldern (Deutsch / English), Platzhalter-Hinweis `<personal_line>`, Vorschau mit einem Beispiel-Lead und Speichern-Knopf. Rein Frontend gegen `ai_config`.

**3. Ja = senden**
Im Prüf-Stapel löst „Ja" künftig aus: `admin_decision = ja` setzen → sofort Jarvis mit `mode: akquise_senden` und der Lead-ID rufen → Rückmeldung im Toast („Nachricht an @handle raus" bzw. „nur DM möglich — Text kopieren"). „Nein" bleibt wie heute.

**4. Versand nur mit deinem Ja**
Der nächtliche Versand-Lauf filtert zusätzlich auf `admin_decision = ja`. Ohne dein Ja geht nie etwas raus — auch dann nicht, wenn die Zone auf Grün stünde.

**5. Wenn keine E-Mail existiert**
Lead bleibt auf Kanal DM, bekommt aber denselben fertigen Text: im Prüf-Stapel erscheint nach dem Ja ein „Text kopieren"-Knopf plus Link zum Instagram-Profil. Automatische DMs bleiben aus (Instagram sperrt Konten dafür).

## Technische Details

- `supabase/functions/pawn-jarvis/index.ts`: Konfig-Felder `template_de`/`template_en`, Vorlagen-Ersetzung nach dem Entwurf in `runAkquiseVerfassen`, `.eq("admin_decision","ja")` in `runAkquiseSenden`, neuer Body-Parameter `lead_ids` für gezielten Einzelversand (nur Admin).
- `src/features/admin/PruefStapel.tsx`: Ja ruft die Funktion, zeigt Ergebnis, DM-Fallback mit Kopier-Knopf.
- Neu `src/features/admin/ErstnachrichtVorlagen.tsx`, eingebunden in `src/pages/admin/AdminAkquise.tsx`.
- Danach nötig: ein Lovable-Deploy von `pawn-jarvis` (kostet Credits) — die Frontend-Teile laufen sofort.
