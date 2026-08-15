import { useEffect, useState } from "react";
import { ruhigeBewegung } from "@/hooks/useFlug";

/**
 * Teil S6 — DER BAUER SAGT EINEN SATZ.
 *
 * Eine Blase, 4,2 Sekunden, dann leise weg. Kein roter Punkt, keine Zahl,
 * kein Knopf zum Wegklicken — wer sie ignoriert, verliert nichts.
 *
 * Jeder Satz kommt höchstens EINMAL pro Sitzung. Das merkt sich der
 * `sessionStorage`: keine Tabelle, keine Spalte, nichts, was den Tab überlebt.
 *
 * Bewegt wird nur `opacity` und `transform` — bei „Bewegung reduzieren"
 * erscheint und verschwindet die Blase ohne Weg.
 */

const ABLAGE = "pawn.sprueche.v1";
const SICHTBAR_MS = 4200;

/**
 * Mobil- und Desktop-Fassung einer Seite stehen oft beide im Baum (nur eine
 * ist per CSS sichtbar). Ohne diese Sperre liefen beide los und es stünden
 * zwei Blasen gleichzeitig — im Browser gesehen.
 */
const laufend = new Set<string>();

function schonGesagt(schluessel: string): boolean {
  try {
    const roh = sessionStorage.getItem(ABLAGE);
    return roh ? (JSON.parse(roh) as string[]).includes(schluessel) : false;
  } catch { return true; /* Kein Speicher — dann lieber schweigen. */ }
}

function merkeGesagt(schluessel: string): void {
  try {
    const roh = sessionStorage.getItem(ABLAGE);
    const liste = roh ? (JSON.parse(roh) as string[]) : [];
    if (!liste.includes(schluessel)) sessionStorage.setItem(ABLAGE, JSON.stringify([...liste, schluessel]));
  } catch { /* Voller Speicher ist kein Grund, den Besuch zu stören. */ }
}

export function BauerSpruch({
  schluessel,
  text,
  verzoegerungMs = 0,
  wenn = true,
  className = "",
  hell = false,
}: {
  /** Unter diesem Namen gilt der Satz als gesagt. */
  schluessel: string;
  text: string;
  verzoegerungMs?: number;
  /** Erst sagen, wenn das stimmt (z. B. „ist ein Original"). */
  wenn?: boolean;
  className?: string;
  /** Auf dunklem Grund: weiße Blase mit schwarzer Schrift kehrt sich um. */
  hell?: boolean;
}) {
  const [zustand, setZustand] = useState<"still" | "da" | "geht">("still");

  useEffect(() => {
    if (!wenn || schonGesagt(schluessel) || laufend.has(schluessel)) return;
    laufend.add(schluessel);
    let raus: ReturnType<typeof setTimeout>;
    let fort: ReturnType<typeof setTimeout>;
    const rein = setTimeout(() => {
      merkeGesagt(schluessel);
      setZustand("da");
      raus = setTimeout(() => {
        setZustand("geht");
        fort = setTimeout(() => setZustand("still"), ruhigeBewegung() ? 120 : 240);
      }, SICHTBAR_MS);
    }, verzoegerungMs);
    return () => {
      laufend.delete(schluessel);
      clearTimeout(rein); clearTimeout(raus); clearTimeout(fort);
    };
  }, [schluessel, verzoegerungMs, wenn]);

  if (zustand === "still") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none z-20 max-w-[24ch] border-[1.5px] px-3 py-2 text-[0.72rem] leading-snug ${
        hell ? "border-white bg-white text-black" : "border-black bg-white text-black shadow-[4px_4px_0_#000]"
      } ${className}`}
      style={{
        opacity: zustand === "da" ? 1 : 0,
        transform: zustand === "da" ? "none" : "translateY(4px)",
        transition: `opacity var(--t-ui, 240ms) var(--k-aus), transform var(--t-ui, 240ms) var(--k-aus)`,
      }}
    >
      {text}
    </div>
  );
}
