/**
 * Teil R8 — WOHER KOMMT DIESES BILD?
 *
 * Die KI-VO trennt zwei Pflichten, und PAWN hat bisher nur die erste erfüllt:
 *
 *   Art. 50 Abs. 1 — wer mit einem KI-SYSTEM SPRICHT, muss das wissen.
 *     Dafür gibt es `AiDisclosureNote` („PAWN ist dein KI-Begleiter …").
 *     Sie hängt an jeder Gesprächsfläche und sagt nichts über Bilder.
 *
 *   Art. 50 Abs. 2/4 — wer ein maschinell erzeugtes BILD sieht, muss das
 *     ebenfalls wissen. Dafür gab es bis heute genau eine Stelle: den
 *     „KI-generiert"-Aufkleber im Première-Video auf der Landing, fest in
 *     `PremiereSection.tsx` eingebaut.
 *
 * Diese Datei liefert die fehlende Auskunft für Standbilder. Es gibt keine
 * Spalte an `products`, die sagt „dieses Foto stammt aus einer Maschine" —
 * das Wissen liegt in `media_assets.origin`. Verbunden sind beide nur über
 * die Bild-Adresse.
 *
 * Adressen aus dem Supabase-Speicher sind signiert (`?token=…`) und werden
 * neu signiert; der Pfad davor bleibt gleich. Deshalb wird ausschließlich der
 * PFAD verglichen, nie die ganze Adresse.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Adresse auf ihren dauerhaften Teil kürzen: ohne Signatur, ohne Anker. */
export function bildPfad(url: string | null | undefined): string {
  const roh = (url ?? "").trim();
  if (!roh) return "";
  const ohneFrage = roh.split("?")[0].split("#")[0];
  return ohneFrage.toLowerCase();
}

/**
 * Die Pfade aller Bilder, die eine Maschine erzeugt hat.
 *
 * Eine Abfrage für die ganze Seite, nicht eine je Kachel. Gelesen wird nur,
 * was ohnehin öffentlich ist (RLS: „public reads media of active houses").
 * Schlägt sie fehl, bleibt die Menge leer — dann steht kein Zeichen an einem
 * Bild, das keines braucht, und keins fehlt an einem, das eines bräuchte,
 * ohne dass jemand es merkt: der Fehler ist still, aber er verfälscht nichts.
 */
export function useKiBilder(): Set<string> {
  const [pfade, setPfade] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let abgebrochen = false;
    void supabase
      .from("media_assets")
      .select("url")
      .eq("kind", "bild")
      .eq("origin", "erzeugt")
      .limit(500)
      .then(({ data }) => {
        if (abgebrochen || !data) return;
        const menge = new Set<string>();
        for (const zeile of data as Array<{ url: string | null }>) {
          const p = bildPfad(zeile.url);
          if (p) menge.add(p);
        }
        setPfade(menge);
      });
    return () => { abgebrochen = true; };
  }, []);

  return pfade;
}

/** Trägt dieses Bild eine KI-Herkunft? */
export function istKiBild(url: string | null | undefined, kiPfade: Set<string>): boolean {
  const p = bildPfad(url);
  return p.length > 0 && kiPfade.has(p);
}
