/**
 * Teil 15b: Die Schwelle — ein kurzer, ruhiger Übergang zwischen der strengen Halle und dem
 * Raum eines Hauses. Zeigt den Namen des Hauses als Türschild, dann wechselt die Optik in die
 * Farbwelt des Hauses. Übergangsart kommt aus house_themes.uebergangsart. Respektiert
 * prefers-reduced-motion (dann kein Übergang — direkt zum Raum).
 */
import { useEffect, useState } from "react";
import type { HouseTheme } from "@/features/houseTheme/theme";

const HOLD_MS = 900;
const OUT_MS = 550;

export function Schwelle({ houseName, theme, onDone }: { houseName: string; theme: HouseTheme; onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setPhase("done"); onDone(); return; }
    const t1 = window.setTimeout(() => setPhase("out"), HOLD_MS);
    const t2 = window.setTimeout(() => { setPhase("done"); onDone(); }, HOLD_MS + OUT_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  const out = phase === "out";
  const art = theme.uebergangsart;

  let overlayStyle: React.CSSProperties = {
    transition: `opacity ${OUT_MS}ms ease, transform ${OUT_MS}ms ease, clip-path ${OUT_MS}ms ease`,
  };
  if (art === "iris") {
    overlayStyle = { ...overlayStyle, clipPath: out ? "circle(0% at 50% 50%)" : "circle(150% at 50% 50%)" };
  } else if (art === "schnitt") {
    overlayStyle = { ...overlayStyle, transform: out ? "scaleX(0)" : "scaleX(1)", transformOrigin: "center" };
  } else if (art === "wisch") {
    overlayStyle = { ...overlayStyle, transform: out ? "translateY(-100%)" : "translateY(0)" };
  } else {
    overlayStyle = { ...overlayStyle, opacity: out ? 0 : 1 };
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ ...overlayStyle, background: theme.farbwelt.bg, color: theme.farbwelt.fg }}
      aria-hidden="true"
    >
      <div
        className="border px-8 py-6 text-center"
        style={{ borderColor: theme.farbwelt.fg, borderWidth: "1.5px" }}
      >
        <p className="text-[0.6rem] uppercase tracking-[0.42em] opacity-60">Sie betreten</p>
        <p className="mt-3" style={{ fontFamily: "Playfair Display, Georgia, serif", fontWeight: 600, fontSize: "clamp(1.6rem, 4vw, 2.6rem)" }}>
          {houseName}
        </p>
      </div>
    </div>
  );
}
