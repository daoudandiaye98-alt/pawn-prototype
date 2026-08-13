import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

/**
 * Teil N — der Bauer im Abendlicht: Systemfigur und einziges Aufmerksamkeitssystem
 * des Studios. Struktur und Verhalten folgen dem freigegebenen Ankunft-Design
 * (pawn-ankunft.html): Gradients body/rim/cheek, Augen-Gruppen eyeL/eyeR,
 * mouth-Pfad; er atmet (4,2 s), blinzelt (~5,5 s), die Augen folgen dem Zeiger,
 * und beim Antippen freut er sich (Squish + breiteres Lächeln).
 *
 * Hinweis: Die Pfad-Geometrie ist aus der Teil-N-Spezifikation rekonstruiert,
 * da die Referenzdatei nicht im Repo liegt — sobald pawn-ankunft.html eintrifft,
 * wird die SVG hier 1:1 ausgetauscht (nur dieser eine Block).
 */

export interface BauerAbendHandle {
  freuen: () => void;
}

interface Props {
  size?: number;
  onTap?: () => void;
  ariaLabel?: string;
  className?: string;
}

const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const BauerAbend = forwardRef<BauerAbendHandle, Props>(function BauerAbend(
  { size = 96, onTap, ariaLabel, className },
  ref,
) {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLButtonElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const [happy, setHappy] = useState(false);
  const [squish, setSquish] = useState(false);

  // Augen folgen dem Zeiger — sanft, wenige Pixel, nie hektisch.
  useEffect(() => {
    if (REDUCED) return;
    const onMove = (e: PointerEvent) => {
      const root = rootRef.current;
      const eyes = eyesRef.current;
      if (!root || !eyes) return;
      const r = root.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.3;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      eyes.style.transform = `translate(${(dx * 2.4).toFixed(2)}px, ${(dy * 1.6).toFixed(2)}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const freuen = () => {
    setHappy(true);
    setSquish(true);
    window.setTimeout(() => setSquish(false), 650);
    window.setTimeout(() => setHappy(false), 1800);
  };
  useImperativeHandle(ref, () => ({ freuen }));

  const tap = () => {
    freuen();
    onTap?.();
  };

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={tap}
      aria-label={ariaLabel ?? "Mit dem Bauern sprechen"}
      className={className}
      style={{
        display: "inline-block",
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        lineHeight: 0,
        animation: squish ? "al-squish 0.65s cubic-bezier(0.34, 1.4, 0.5, 1)" : undefined,
        transformOrigin: "50% 100%",
      }}
    >
      <span
        style={{
          display: "inline-block",
          animation: REDUCED ? undefined : "al-atmen 4.2s ease-in-out infinite",
          transformOrigin: "50% 100%",
        }}
      >
        <svg width={size} height={size * 1.3} viewBox="0 0 100 130" role="img" aria-hidden="true">
          <defs>
            {/* Körper: warmes Elfenbein, vom Lichtpool unten bernstein angeleuchtet */}
            <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f7efdd" />
              <stop offset="0.62" stopColor="#eddcb4" />
              <stop offset="1" stopColor="#e8c284" />
            </linearGradient>
            {/* Randlicht von unten */}
            <radialGradient id={`rim-${uid}`} cx="0.5" cy="1.1" r="0.9">
              <stop offset="0" stopColor="rgba(244,198,103,0.85)" />
              <stop offset="0.55" stopColor="rgba(244,198,103,0.18)" />
              <stop offset="1" stopColor="rgba(244,198,103,0)" />
            </radialGradient>
            {/* Wangen */}
            <radialGradient id={`cheek-${uid}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(224,154,58,0.5)" />
              <stop offset="1" stopColor="rgba(224,154,58,0)" />
            </radialGradient>
          </defs>

          {/* Weicher Bodenschein */}
          <ellipse cx="50" cy="124" rx="34" ry="5" fill="rgba(244,198,103,0.16)" />

          {/* Körper — Kopf, Kragen, Rock, Sockel; weiche, runde Silhouette */}
          <g fill={`url(#body-${uid})`}>
            <circle cx="50" cy="32" r="26" />
            <path d="M29 60 q21 10 42 0 l-5 12 q-16 7 -32 0 Z" />
            <path d="M35 73 q15 6 30 0 l7 30 q-22 9 -44 0 Z" />
            <path d="M22 105 q28 -8 56 0 l0 10 q-28 8 -56 0 Z" />
          </g>
          {/* Randlicht liegt über dem Körper */}
          <g fill={`url(#rim-${uid})`}>
            <circle cx="50" cy="32" r="26" />
            <path d="M35 73 q15 6 30 0 l7 30 q-22 9 -44 0 Z" />
            <path d="M22 105 q28 -8 56 0 l0 10 q-28 8 -56 0 Z" />
          </g>

          {/* Wangen */}
          <ellipse cx="33" cy="38" rx="6.5" ry="4.5" fill={`url(#cheek-${uid})`} />
          <ellipse cx="67" cy="38" rx="6.5" ry="4.5" fill={`url(#cheek-${uid})`} />

          {/* Augen — folgen dem Zeiger (Gruppe), blinzeln einzeln */}
          <g ref={eyesRef} style={{ transition: "transform 0.35s ease" }}>
            {happy ? (
              <g stroke="#2a2116" strokeWidth={3} fill="none" strokeLinecap="round">
                <path d="M34 30 q6 -6 12 0" />
                <path d="M54 30 q6 -6 12 0" />
              </g>
            ) : (
              <>
                <g
                  className="al-eye"
                  style={{ transformOrigin: "40px 30px", animation: REDUCED ? undefined : "al-blinzeln 5.5s ease-in-out infinite" }}
                >
                  <ellipse cx="40" cy="30" rx="5.4" ry="7" fill="#2a2116" />
                  <circle cx="42" cy="27.5" r="1.8" fill="#fdf6e6" />
                </g>
                <g
                  className="al-eye"
                  style={{ transformOrigin: "60px 30px", animation: REDUCED ? undefined : "al-blinzeln 5.5s ease-in-out 0.07s infinite" }}
                >
                  <ellipse cx="60" cy="30" rx="5.4" ry="7" fill="#2a2116" />
                  <circle cx="62" cy="27.5" r="1.8" fill="#fdf6e6" />
                </g>
              </>
            )}
          </g>

          {/* Mund — ruhiges Lächeln; beim Freuen breiter und offener */}
          <path
            d={happy ? "M40 43 q10 9 20 0" : "M43 43 q7 5 14 0"}
            stroke="#2a2116"
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "d 0.3s ease" }}
          />
        </svg>
      </span>
    </button>
  );
});
