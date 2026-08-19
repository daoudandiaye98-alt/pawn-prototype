/**
 * Teil M3 — die Eröffnung.
 *
 *   0,0 s   Papierfläche, sonst nichts
 *   0,0 s   P♟WN erscheint: die Sperrung zieht sich zusammen, dazu 10 px Anstieg
 *           und Aufblenden — 2600 ms, var(--kurve-fein)
 *   2,7 s   Die Papierfläche blendet ab (1100 ms), das Heft steigt aus 26 px auf
 *           und setzt sich (1600 ms, gleiche Kurve)
 *   4,6 s   Der Hinweis „Blättern" erscheint leise und verschwindet beim ersten Rollen
 *
 * Einmal je Sitzung. Ein schönes Intro beim fünften Aufruf ist eine Wand,
 * kein Auftritt.
 *
 * Die Fläche liegt über allem, nimmt aber keine Zeiger- und keine Tastatur-
 * ereignisse an und ist für Vorlesehilfen unsichtbar: wer sofort blättern will,
 * blättert sofort. Es gibt keinen Zustand, in dem die Eröffnung etwas festhält.
 */
import { useEffect, useState } from "react";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

const SCHLUESSEL = "pawn.heft.eroeffnet";
/** Papierfläche weg (2700 + 1100) plus ein Wimpernschlag Reserve. */
const ENDE_MS = 3900;

export function eroeffnungFaellig(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SCHLUESSEL) !== "1";
  } catch {
    // Ohne Sitzungsspeicher (privater Modus, blockierte Speicher) lieber einmal
    // zu viel zeigen als die Seite gar nicht aufbauen.
    return true;
  }
}

function merken() {
  try {
    window.sessionStorage.setItem(SCHLUESSEL, "1");
  } catch { /* dann eben nicht */ }
}

export function Eroeffnung({ reduziert, onFertig }: { reduziert: boolean; onFertig: () => void }) {
  const [weg, setWeg] = useState(false);

  useEffect(() => {
    merken();
    const dauer = reduziert ? 400 : ENDE_MS;
    const uhr = window.setTimeout(() => { setWeg(true); onFertig(); }, dauer);
    return () => window.clearTimeout(uhr);
  }, [reduziert, onFertig]);

  if (weg) return null;
  return (
    <div className={`heft-eroeffnung${reduziert ? " ruhig" : ""}`} aria-hidden>
      <PawnWordmark className="heft-eroeffnung-marke" gliedern={!reduziert} />
    </div>
  );
}

/** Der Hinweis. Erscheint spät, verschwindet beim ersten Rollen — und nie wieder. */
export function BlaetternHinweis({ reduziert }: { reduziert: boolean }) {
  const [fort, setFort] = useState(false);

  useEffect(() => {
    if (fort) return;
    const beiScroll = () => setFort(true);
    window.addEventListener("scroll", beiScroll, { passive: true, once: true });
    return () => window.removeEventListener("scroll", beiScroll);
  }, [fort]);

  if (fort) return null;
  return (
    <p className={`heft-hinweis${reduziert ? " ruhig" : ""}`} aria-hidden>
      <span>Blättern</span>
    </p>
  );
}
