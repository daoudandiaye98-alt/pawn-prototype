import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";

/**
 * Teil N — der Bauer im Abendlicht: Systemfigur und einziges Aufmerksamkeitssystem
 * des Studios. Darstellung und Bewegung sind 1:1 aus der freigegebenen
 * Referenzdatei pawn-ankunft.html übernommen (Kopf r=46, Blinzeln 5,5 s,
 * Squish 0,5 s, Augen-Clamp /320, Pupillen-Versatz 3.4/2.6) — die Keyframes
 * bob/arrive/squish/shbob/blink liegen in src/styles/abendlicht.css.
 * Einzige technische Abweichung: die Gradient-IDs body/rim/cheek tragen einen
 * Instanz-Suffix, weil dieselbe Komponente mehrfach auf einer Seite stehen kann
 * und SVG-IDs im Dokument eindeutig sein müssen. Alle Werte sind unverändert.
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

const MUND_RUHIG = "M97 87 Q105 93 113 87";
const MUND_FREUDE = "M95 85 Q105 97 115 85";

export const BauerAbend = forwardRef<BauerAbendHandle, Props>(function BauerAbend(
  { size = 105, onTap, ariaLabel, className },
  ref,
) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef<HTMLButtonElement>(null);
  const eyeLRef = useRef<SVGGElement>(null);
  const eyeRRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const mouthTimer = useRef<number | undefined>(undefined);

  // Augen folgen dem Zeiger (nur ohne prefers-reduced-motion) — exakte Referenz-Logik.
  useEffect(() => {
    if (REDUCED) return;
    const onMove = (e: PointerEvent) => {
      const wrap = wrapRef.current;
      const eyeL = eyeLRef.current;
      const eyeR = eyeRRef.current;
      if (!wrap || !eyeL || !eyeR) return;
      const r = wrap.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 320));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.3)) / 320));
      const tx = dx * 3.4, ty = dy * 2.6;
      eyeL.style.transform = `translate(${tx}px, ${ty}px)`;
      eyeR.style.transform = `translate(${tx}px, ${ty}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => () => window.clearTimeout(mouthTimer.current), []);

  // Antippen: er freut sich — Squish neu anstoßen + breiteres Lächeln für 900 ms.
  const delight = () => {
    const wrap = wrapRef.current;
    const mouth = mouthRef.current;
    if (wrap) {
      wrap.classList.remove("happy");
      void wrap.offsetWidth;
      wrap.classList.add("happy");
    }
    if (mouth) {
      mouth.setAttribute("d", MUND_FREUDE);
      window.clearTimeout(mouthTimer.current);
      mouthTimer.current = window.setTimeout(() => mouth.setAttribute("d", MUND_RUHIG), 900);
    }
  };
  useImperativeHandle(ref, () => ({ freuen: delight }));

  // Kleinere Größenvarianten skalieren die gesamte SVG proportional (210×252),
  // der Schatten skaliert mit; die Keyframe-Werte bleiben unverändert.
  const k = size / 210;

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={() => { delight(); onTap?.(); }}
      aria-label={ariaLabel ?? "Mit dem Bauern sprechen"}
      className={`pawn-wrap ${className ?? ""}`}
    >
      <svg className="pawn" width={size} height={size * 1.2} viewBox="0 0 210 252" aria-hidden="true">
        <defs>
          <radialGradient id={`body-${uid}`} cx="38%" cy="26%" r="85%">
            <stop offset="0%" stopColor="#fbf5e8" />
            <stop offset="45%" stopColor="#efe4cd" />
            <stop offset="78%" stopColor="#d3c3a3" />
            <stop offset="100%" stopColor="#b3a184" />
          </radialGradient>
          <radialGradient id={`rim-${uid}`} cx="50%" cy="115%" r="80%">
            <stop offset="0%" stopColor="rgba(244,198,103,.55)" />
            <stop offset="55%" stopColor="rgba(244,198,103,0)" />
          </radialGradient>
          <linearGradient id={`cheek-${uid}`} x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(224,144,110,.5)" />
            <stop offset="100%" stopColor="rgba(224,144,110,.15)" />
          </linearGradient>
        </defs>

        {/* Körper */}
        <g>
          <circle cx="105" cy="64" r="46" fill={`url(#body-${uid})`} />
          <ellipse cx="105" cy="118" rx="38" ry="13" fill={`url(#body-${uid})`} />
          <path d="M83 128 C83 170 70 196 62 210 L148 210 C140 196 127 170 127 128 Z" fill={`url(#body-${uid})`} />
          <path d="M52 224 C52 213 76 206 105 206 C134 206 158 213 158 224 C158 235 134 242 105 242 C76 242 52 235 52 224 Z" fill={`url(#body-${uid})`} />
          {/* warmes Bühnenlicht von unten */}
          <path d="M52 224 C52 213 76 206 105 206 C134 206 158 213 158 224 C158 235 134 242 105 242 C76 242 52 235 52 224 Z" fill={`url(#rim-${uid})`} />
          <path d="M83 128 C83 170 70 196 62 210 L148 210 C140 196 127 170 127 128 Z" fill={`url(#rim-${uid})`} opacity=".7" />
          {/* Glanzlicht */}
          <ellipse cx="86" cy="42" rx="16" ry="10" fill="rgba(255,255,255,.8)" transform="rotate(-24 86 42)" />
          <ellipse cx="76" cy="58" rx="5" ry="3.4" fill="rgba(255,255,255,.55)" />
        </g>

        {/* Gesicht */}
        <g className="eyes">
          <g ref={eyeLRef}>
            <ellipse cx="88" cy="66" rx="6.5" ry="9" fill="#241c12" />
            <circle cx="90.4" cy="62.5" r="2.1" fill="#fff" opacity=".9" />
          </g>
          <g ref={eyeRRef}>
            <ellipse cx="124" cy="66" rx="6.5" ry="9" fill="#241c12" />
            <circle cx="126.4" cy="62.5" r="2.1" fill="#fff" opacity=".9" />
          </g>
        </g>
        <ellipse cx="76" cy="80" rx="8" ry="4.4" fill={`url(#cheek-${uid})`} />
        <ellipse cx="136" cy="80" rx="8" ry="4.4" fill={`url(#cheek-${uid})`} />
        <path ref={mouthRef} d={MUND_RUHIG} stroke="#241c12" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </svg>
      <div
        className="pawn-shadow"
        aria-hidden="true"
        style={{ width: 150 * k, height: 26 * k, margin: `${-8 * k}px auto 0` }}
      />
    </button>
  );
});
