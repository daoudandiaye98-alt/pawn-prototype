/**
 * Level-Up-Vollbild-Moment: schwarzer Screen, Glyph groß, "Aus dem Bauern
 * wird der Springer.", 2 s, sanfter Rückzug. Emittiert einmalig eine
 * Notification.
 */
import { useEffect, useRef, useState } from "react";
import { useDesignerLevel, type DesignerLevel } from "./useDesignerLevel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const ORDER: DesignerLevel["level"][] = ["bauer", "springer", "laeufer", "turm", "dame"];
const LABEL_ACC: Record<DesignerLevel["level"], string> = {
  bauer: "dem Bauern",
  springer: "dem Springer",
  laeufer: "dem Läufer",
  turm: "dem Turm",
  dame: "der Dame",
};

function storageKey(uid: string) { return `pawn:last-level:${uid}`; }

export function LevelUpOverlay({ designerId }: { designerId?: string }) {
  const { user } = useAuth();
  const { level } = useDesignerLevel(designerId);
  const [showing, setShowing] = useState<{ from: DesignerLevel["level"]; to: DesignerLevel["level"] } | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!user || !designerId) return;
    const key = storageKey(user.id);
    const stored = (localStorage.getItem(key) as DesignerLevel["level"] | null);

    // First load: seed baseline silently, no popup.
    if (!seededRef.current) {
      seededRef.current = true;
      if (!stored) { localStorage.setItem(key, level.level); return; }
    }
    if (!stored) return;
    const oldIdx = ORDER.indexOf(stored);
    const newIdx = ORDER.indexOf(level.level);
    if (newIdx > oldIdx) {
      setShowing({ from: stored, to: level.level });
      localStorage.setItem(key, level.level);
      // Notify (best-effort).
      void supabase.from("notifications").insert({
        user_id: user.id,
        type: "designer.level_up",
        title: `Aus ${LABEL_ACC[stored]} wird ${LABEL_ACC[level.level]}.`,
        body: "Ein neues Level. Dein Studio wächst.",
        link: "/studio",
      } as never);
      window.setTimeout(() => setShowing(null), 2400);
    }
  }, [user, designerId, level.level]);

  if (!showing) return null;
  const toGlyph = level.glyph;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-white animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6 text-center px-8">
        <span className="font-serif text-[10rem] leading-none animate-in zoom-in-50 duration-700">{toGlyph}</span>
        <p className="font-serif text-3xl md:text-4xl max-w-2xl">
          Aus {LABEL_ACC[showing.from]} wird {LABEL_ACC[showing.to]}.
        </p>
        <p className="text-[0.68rem] uppercase tracking-[0.32em] text-white/60">Ein neues Level</p>
      </div>
    </div>
  );
}
