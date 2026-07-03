/**
 * MutationMoment — a sentence, two words. A mutation is a moment, not a setting.
 *
 * If the identity has no open proposal, we synthesize one from the current
 * genome so the moment can be *experienced* even before the evolution engine
 * has enough signal to speak on its own. The animation on ratify is the proof:
 * the value moves in front of the user, not behind their back.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useStore, useCommand, commands, selectors, defaultIdentityId,
} from "@/core";
import type { StyleGenome, GenomeAxis } from "@/core";

const AXIS_LABEL: Record<GenomeAxis, string> = {
  structure: "Struktur", edge: "Kante", elegance: "Eleganz",
  darkness: "Dunkel", sensuality: "Sinnlichkeit", utility: "Nutzen",
};

const PHRASES: Record<GenomeAxis, string> = {
  structure: "Deine Struktur scheint sich zu verhärten. Soll ich das übernehmen?",
  edge: "Deine Kante wird sichtbarer. Soll ich das übernehmen?",
  elegance: "Deine Eleganz zieht sich zurück. Soll ich das übernehmen?",
  darkness: "Dein Dunkel wird tiefer. Soll ich das übernehmen?",
  sensuality: "Deine Sinnlichkeit sucht Raum. Soll ich das übernehmen?",
  utility: "Dein Sinn für Nutzen wächst. Soll ich das übernehmen?",
};

export function MutationMoment() {
  const identity = useStore((s) => selectors.getIdentity(s, defaultIdentityId));
  const dispatch = useCommand();
  const [status, setStatus] = useState<"idle" | "accepted" | "dismissed">("idle");
  const [displayed, setDisplayed] = useState<number | null>(null);
  const animRef = useRef<number | null>(null);

  // Compute a candidate axis + target from the current genome.
  const candidate = useMemo(() => {
    if (!identity) return null;
    const g = identity.dna.genome;
    // Find the axis furthest from 0.5 that has room to move in that direction.
    const axes = Object.keys(g) as GenomeAxis[];
    let best: { axis: GenomeAxis; from: number; to: number } | null = null;
    for (const a of axes) {
      const from = g[a];
      const direction = from >= 0.5 ? +1 : -1;
      const target = Math.max(0, Math.min(1, from + direction * 0.12));
      if (!best || Math.abs(target - from) > Math.abs(best.to - best.from)) {
        best = { axis: a, from, to: target };
      }
    }
    return best;
  }, [identity]);

  useEffect(() => {
    if (candidate) setDisplayed(candidate.from);
  }, [candidate]);

  if (!identity || !candidate) return null;

  function animate(from: number, to: number) {
    const start = performance.now();
    const duration = 1200;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplayed(from + (to - from) * eased);
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }

  function accept() {
    if (!candidate || !identity) return;
    // Propose, then immediately ratify — the moment is one gesture.
    const proposed = dispatch(commands.proposeMutation, {
      identityId: defaultIdentityId,
      to: { [candidate.axis]: candidate.to } as Partial<StyleGenome>,
      rationale: "Ratified in the moment.",
    });
    if (!proposed.ok) return;
    const ev = proposed.events.find((e) => e.type === "mutation.proposed");
    if (!ev || !("payload" in ev)) return;
    const mutationId = (ev.payload as { mutation: { id: string } }).mutation.id;
    dispatch(commands.ratifyMutation, {
      identityId: defaultIdentityId,
      mutationId: mutationId as never,
    });
    setStatus("accepted");
    // Damping is 60% — animate to the actual landing value.
    const landed = candidate.from + (candidate.to - candidate.from) * 0.6;
    animate(candidate.from, landed);
  }

  return (
    <div className="border-y border-primary-foreground/15 bg-ink-soft/40 px-6 py-10 md:px-10 md:py-14">
      <p className="text-[0.6rem] uppercase tracking-[0.32em] text-primary-foreground/50">
        Ein Vorschlag
      </p>
      <p className="mt-5 max-w-2xl font-serif text-2xl leading-snug text-primary-foreground md:text-3xl">
        {status === "accepted"
          ? `Übernommen. Deine ${AXIS_LABEL[candidate.axis].toLowerCase()}-Achse hat sich verschoben.`
          : status === "dismissed"
          ? "Nicht jetzt. Wir kommen später darauf zurück."
          : PHRASES[candidate.axis]}
      </p>

      <div className="mt-8 flex items-center gap-6">
        <div className="flex-1 max-w-md">
          <div className="flex items-baseline justify-between text-[0.62rem] uppercase tracking-[0.28em] text-primary-foreground/60">
            <span>{AXIS_LABEL[candidate.axis]}</span>
            <span className="pawn-numeral text-primary-foreground/80">
              {Math.round((displayed ?? candidate.from) * 100)}
            </span>
          </div>
          <div className="mt-3 h-px w-full bg-primary-foreground/20">
            <div
              className="h-[2px] bg-primary-foreground"
              style={{ width: `${Math.round((displayed ?? candidate.from) * 100)}%`, transform: "translateY(-0.5px)" }}
            />
          </div>
        </div>
        {status === "idle" && (
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={accept}
              className="border-b border-primary-foreground pb-1 uppercase tracking-[0.24em] text-primary-foreground hover:opacity-80"
            >
              annehmen
            </button>
            <button
              onClick={() => setStatus("dismissed")}
              className="uppercase tracking-[0.24em] text-primary-foreground/55 hover:text-primary-foreground/80"
            >
              nicht jetzt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
