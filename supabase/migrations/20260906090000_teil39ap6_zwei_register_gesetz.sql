-- Teil 39 AP6 — Zwei-Register-Gesetz kodifiziert. Erweitert das bestehende ai_config.voice_law
-- additiv (das bisherige "text"-Feld gilt weiter für die Außenauge-Kritiksprache, unverändert) —
-- neues Feld "zwei_register" für die allgemeine Bühne/Bedienung-Trennung.

UPDATE public.ai_config
SET value = jsonb_set(value, '{zwei_register}', '{
  "beschreibung": "Zwei Sprachregister, bewusst getrennt: Bühne (poetisch) für Flächen, die zeigen/erzählen. Bedienung (Klartext) für Flächen, wo jemand etwas TUN muss oder eine Konsequenz trägt.",
  "buehne": "Playfair-Serif-Ton, darf andeuten statt erklären, Bilder statt Aufzählung. Gilt: Landing-Hero, Welt-Seiten (Mode/Interior/Kunst), Cover-Momente, redaktionelle/editoriale Texte, Marken-Erzählung.",
  "bedienung": "Inter-Ton, ein Satz = eine Handlung oder ein Fakt, nie zweideutig, keine Metapher. Gilt: Formulare, Buttons, Bestätigungen, Einstellungen, alles mit einem Preis/einer Frist/einer Unterschrift.",
  "fehler_formel": "Jede Fehlermeldung besteht aus genau zwei Teilen: (1) was ist passiert, ein Satz, ohne Fachbegriff/Code/Stacktrace; (2) was die Person jetzt tun kann, ein Satz mit einem Verb (nochmal versuchen, uns schreiben, Feld prüfen). Nie nur Teil 1 ohne Teil 2.",
  "geld_vertrag_zusatz": "Auf Geld- und Vertragsflächen gilt Bedienung IMMER, auch innerhalb einer sonst poetischen Bühnen-Umgebung (z.B. die Kaufleiste auf einer Bühnen-Produktseite). Beträge, Fristen, Kündigungsfolgen, Widerrufsrechte werden immer ausgeschrieben, nie angedeutet."
}'::jsonb)
WHERE key = 'voice_law';
