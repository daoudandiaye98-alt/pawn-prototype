## Warum bisher nur das Menü übersetzt wird (geprüft)

- `site_content` hat **22 Zeilen, davon 0 mit englischem Text** — jeder CMS-Text fällt auf Deutsch zurück.
- Im Code stehen **~99 Editable-Schlüssel**, aber nur 22 davon existieren überhaupt als Zeile in der Datenbank.
- Der Rest der Seite (Shop, Warenkorb, Kasse, Produktseiten, Studio, Admin, Rechtstexte) besteht aus **fest im Code stehenden deutschen Sätzen**. Nur ~100 Menü-/Konto-Begriffe liegen im Wörterbuch `src/lib/i18n.tsx`. Der Schalter kann alles andere technisch gar nicht erreichen.

Ein Wörterbuch von Hand für tausende Sätze zu pflegen ist unrealistisch. Deshalb: eine **automatische Übersetzungsschicht**, die einmal lernt und danach dauerhaft aus der Datenbank bedient wird.

## Was gebaut wird

### 1. Übersetzungs-Gedächtnis in der Datenbank
Neue Tabelle `ui_translations`: deutscher Satz (als Prüfsumme) → englische Fassung, plus Zeitstempel. Öffentlich lesbar, schreiben nur über die Übersetzungs-Funktion. So wird jeder Satz **einmal** übersetzt und danach für alle Besucher sofort ausgeliefert — keine laufenden KI-Kosten pro Besuch.

### 2. Automatische Erfassung sichtbarer Texte
Ein globaler Übersetzungs-Wächter im Frontend:
- Ist Englisch aktiv, sammelt er alle sichtbaren deutschen Textstellen der aktuellen Seite (auch nach Nachladen, über einen DOM-Beobachter).
- Bekannte Sätze werden sofort aus dem Gedächtnis ersetzt.
- Unbekannte Sätze gehen gebündelt an eine Edge Function `translate-batch` (Claude/OpenAI, Stil-Vorgabe: Modehaus-Ton, kurz, keine Erfindungen), das Ergebnis wird gespeichert und eingesetzt.
- Nicht angefasst: Wortmarke PAWN, Eigennamen der Häuser, Preise, Zahlen, E-Mails, Links, Eingabefelder-Inhalte, Code-artige Zeichenketten. Elemente lassen sich mit `data-no-translate` ausnehmen.

### 3. CMS-Texte gleich mit
- Alle ~99 Editable-Schlüssel werden beim ersten Speichern automatisch als Zeile angelegt (statt nur im Code zu existieren).
- Der bestehende Admin-Knopf „Offene übersetzen" füllt `value_en` für alle Schlüssel; Editable bevorzugt weiterhin `value_en`, bevor die automatische Schicht greift.

### 4. Rechtstexte
AGB, Impressum, Datenschutz, Widerruf werden mitübersetzt, mit einer Hinweiszeile oben in der englischen Fassung: „This is a non-binding translation. The German version is legally authoritative."

### 5. Vorwärmen
Ein Admin-Knopf unter `/admin/inhalte`: „Englische Fassung vorwärmen" — läuft einmal über die wichtigsten Seiten und füllt das Gedächtnis, damit Besucher nie auf eine Übersetzung warten.

## Technische Details

- Neue Tabelle `ui_translations(hash text pk, de text, en text, created_at, updated_at)`, GRANT select für anon/authenticated, Schreibrechte nur service_role; Edge Function schreibt.
- Neue Edge Function `translate-batch` (bis 50 Sätze pro Aufruf, Ergebnisse in einem Rutsch gespeichert) — **muss über Lovable deployt werden**.
- Frontend: `src/lib/autoTranslate.ts` (Sammler + Ersetzer, MutationObserver, Debounce) und Einbindung im bestehenden Sprach-Kontext; `LanguageToggle` bleibt unverändert.
- Anfangs-Wörterbuch aus `src/lib/i18n.tsx` wird beim Start ins Gedächtnis übernommen, damit bestehende Übersetzungen Vorrang haben.
- Deutsch bleibt Standard und wird nie verändert — beim Zurückschalten wird der Originaltext wiederhergestellt.
- Abschluss: `npm run build` und Typecheck grün, Prüfung auf 390px und Desktop.
