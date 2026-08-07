# Design-Referenz — Teil 27 „Die Bühne"

Dieses Verzeichnis enthält die verbindlichen HTML-Referenzen für den Neubau der öffentlichen Seiten. Claude Code setzt 1:1 dagegen um — nicht frei interpretieren.

## Die drei Gesetze (schlagen jede andere Regel)
1. **Das Bild ist der Held.** Chrome schrumpft, Bilder wachsen. Produktbilder brechen aus dem Raster, laufen über Ränder, nehmen bis zu 80 % des Viewports. Typografie darf auf Bildern stehen (weiße Playfair oder schwarzer Balken-Unterleger — nie halbtransparente Verläufe).
2. **Schwarz-Weiß gilt für die Halle, nie für die Kunst.** Chrome bleibt monochrom (#000/#FFF, #404040 für Sekundärtext). Werk- und Produktbilder zeigen ihre echten Farben — der Graustufen-Filter auf Kunst/Produktbildern wird überall entfernt.
3. **Monumentalität gehört dem Werk, nicht dem System.** Keine dekorativen Koordinaten, Registrier-Ecken oder System-Ornamente auf öffentlichen Seiten. Die Verwandlungs-Figuren (Bauer→Dame) sind das einzige Systemzeichen, klein gesetzt.

## Struktur der Landing (landing.html)
1. Cover: Werk in voller Höhe (100svh), Kicker als schwarzer Balken „Der kuratierte Marktplatz", H1 „Kunst von Händen, nicht von Fabriken.", Subline mit den drei Welten, zwei CTAs (Ausstellung betreten / Als Designer bewerben), Werk-Credit unten links (№ · Haus · Stadt). Header transparent auf dem Cover, weiß mit Haarlinie danach.
2. Klarheits-Leiste: drei Fakten (Kuratiert / 93 % an die Hände / Drei Welten).
3. Drei Welten: großflächige Werkbilder mit Typo darauf, versetzte Höhen.
4. Ausgabe: 5 Werke groß und ungleich versetzt, Credit-Zeile (Haus · Welt · Preis).
5. Concierge (schwarze Sektion): das DNA-Textfeld als „Frag die Halle" mit Erklärung und Bild-Upload-Hinweis. Nicht mehr als Empfang, sondern als Dienst in Seitenmitte.
6. Designer-Finale: „Jeder beginnt als Bauer. Keiner bleibt einer." + Figuren-Zeichen + Haus eröffnen.
7. Schmaler Footer.

## Platzhalter-Konvention
Farbige Flächen mit Label „Werk · Bild folgt" stehen für echte Werkbilder. Beim Umsetzen: echte Bilder aus Mediathek/Produkten laden; wo keine existieren, neutraler Leerzustand — NIEMALS die Platzhalter-Farbflächen in Produktion übernehmen.

Die Datei landing.html liefert Claude (Chat) im nächsten Schritt nach — sie ist die pixelgenaue Vorlage zu dieser Struktur.
