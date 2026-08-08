import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "./PawnFigur.css";

/**
 * PAWN wird Person — die eine gemeinsame Figur, überall im Studio und beim Kunden.
 * Geometrie/Timings folgen 1:1 docs/design-referenz/bauer.html (verbindliche Referenz).
 * Keine Kopien: jede Stelle im Produkt, die "PAWN als Figur" zeigt, nutzt diese Datei.
 *
 * Rang-Formen (bauer/springer/laeufer/turm/dame) sind eine neue, eigenständige
 * Ergänzung — bauer.html zeigt nur den Bauer. Es gibt keine vorhandenen Pfad-Daten
 * aus der Verwandlungs-Sektion (dort nur Unicode-Schachzeichen ♟♞♝♜♛), daher wurden
 * kleine, zurückhaltende Silhouette-Akzente neu entworfen. Gesicht bleibt in jedem
 * Rang identisch positioniert (Augen bei cx 40/60, cy 30).
 */

export type PawnRank = "bauer" | "springer" | "laeufer" | "turm" | "dame";
export type PawnEyeState = "normal" | "happy" | "sleep" | "shrug";

const BODY_FILL_DEFAULT = "#000";
const BODY_FILL_INVERT = "#fff";
const EYE_FILL_DEFAULT = "#fff";
const EYE_FILL_INVERT = "#000";

export const PAWN_SQUISH_LINES = [
  "Ich bin da.",
  "Alles im Blick.",
  "Die Halle schläft nie. Ich auch nicht.",
  "Schöner Tag für einen Zug.",
];

function RankAccent({ rank, fill }: { rank: PawnRank; fill: string }) {
  switch (rank) {
    case "springer":
      // Kleine Ohr-/Mähnen-Kerbe seitlich am Kopf — Ritter-Anmutung.
      return <path d="M26 14 L34 6 L36 18 Z" fill={fill} />;
    case "laeufer":
      // Diagonaler Schlitz über dem Kopf — Bischofsmitra-Anmutung.
      return (
        <path
          d="M39 12 L61 20"
          stroke={fill === BODY_FILL_DEFAULT ? EYE_FILL_DEFAULT : EYE_FILL_INVERT}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "turm":
      // Zinnen oben am Kopf — Turm-Anmutung.
      return (
        <g fill={fill}>
          <rect x="39" y="0" width="6" height="7" />
          <rect x="47" y="0" width="6" height="7" />
          <rect x="55" y="0" width="6" height="7" />
        </g>
      );
    case "dame":
      // Kleine Krone oben am Kopf — Damen-Anmutung.
      return (
        <g fill={fill}>
          <path d="M36 8 L41 -0 L44 8 Z" transform="translate(0,2)" />
          <path d="M46 4 L50 -4 L54 4 Z" transform="translate(0,2)" />
          <path d="M56 8 L59 0 L64 8 Z" transform="translate(0,2)" />
        </g>
      );
    case "bauer":
    default:
      return null;
  }
}

interface PawnBodyProps {
  rank: PawnRank;
  fill: string;
}

function PawnBody({ rank, fill }: PawnBodyProps) {
  return (
    <g fill={fill}>
      <circle cx="50" cy="32" r="27" />
      <path d="M27 61h46l-6.5 13H33.5z" />
      <path d="M34 74h32l6.5 31H27.5z" />
      <rect x="19" y="105" width="62" height="13" />
      <RankAccent rank={rank} fill={fill} />
    </g>
  );
}

interface PawnEyesProps {
  eyeState: PawnEyeState;
  fill: string;
  rx?: number;
  ry?: number;
  eyewrapRef?: React.Ref<SVGGElement>;
}

function PawnEyes({ eyeState, fill, rx = 6, ry = 7.8, eyewrapRef }: PawnEyesProps) {
  if (eyeState === "shrug") {
    return (
      <g fill={fill}>
        <ellipse cx="40" cy="30" rx={rx} ry={2.6} />
        <ellipse cx="60" cy="30" rx={rx} ry={2.6} />
      </g>
    );
  }
  if (eyeState === "happy") {
    return (
      <g stroke={fill} strokeWidth={3} fill="none" strokeLinecap="round">
        <path d="M33.5 30 q6.5 -6.5 13 0" />
        <path d="M53.5 30 q6.5 -6.5 13 0" />
      </g>
    );
  }
  return (
    <g ref={eyewrapRef} className="pf-eyewrap" fill={fill}>
      <ellipse className="pf-eye pf-eyeL" cx="40" cy="30" rx={rx} ry={ry} />
      <ellipse className="pf-eye pf-eyeR" cx="60" cy="30" rx={rx} ry={ry} />
    </g>
  );
}

export interface PawnFigurSvgProps {
  className?: string;
  invert?: boolean;
  rank?: PawnRank;
  eyeState?: PawnEyeState;
  eyeSize?: { rx: number; ry: number };
}

/** Reine Darstellung ohne Interaktion — für Mini-Icons, Zustands-Karten, Header. */
export function PawnFigurSvg({ className, invert = false, rank = "bauer", eyeState = "normal", eyeSize }: PawnFigurSvgProps) {
  const bodyFill = invert ? BODY_FILL_INVERT : BODY_FILL_DEFAULT;
  const eyeFill = invert ? EYE_FILL_INVERT : EYE_FILL_DEFAULT;
  return (
    <svg viewBox="0 0 100 132" className={className} aria-hidden="true">
      <PawnBody rank={rank} fill={bodyFill} />
      <PawnEyes eyeState={eyeState} fill={eyeFill} rx={eyeSize?.rx} ry={eyeSize?.ry} />
    </svg>
  );
}

export interface PawnFigurHandle {
  celebrate: () => void;
  squish: () => void;
}

export interface PawnFigurProps {
  size?: number;
  rank?: PawnRank;
  className?: string;
  arrive?: boolean;
  interactive?: boolean;
  showShadow?: boolean;
  ariaLabel?: string;
  onTap?: (line: string) => void;
  /** Farbgesetz: "light" (Standard) = schwarzer Körper/weiße Augen für hellen Grund,
   * "dark" = weißer Körper/schwarze Augen für dunklen Grund (z.B. Vollbild-Momente). */
  tone?: "light" | "dark";
}

/**
 * Die interaktive Hauptfigur (Studio-Hub-Hero, Kunden-Concierge): Ankunft,
 * Wippen, Blinzeln, Augen folgen dem Zeiger, Einschlafen nach 11s Untätigkeit,
 * Antippen (Squish + Zeile), Feiern (Sprung + Funken) über Ref auslösbar.
 */
export const PawnFigur = forwardRef<PawnFigurHandle, PawnFigurProps>(function PawnFigur(
  { size = 200, rank = "bauer", className, arrive = true, interactive = true, showShadow = true, ariaLabel = "PAWN — antippen", onTap, tone = "light" },
  ref,
) {
  const bodyFill = tone === "dark" ? BODY_FILL_INVERT : BODY_FILL_DEFAULT;
  const eyeFill = tone === "dark" ? EYE_FILL_INVERT : EYE_FILL_DEFAULT;
  const stageRef = useRef<HTMLDivElement>(null);
  const pawnRef = useRef<HTMLDivElement>(null);
  const squishRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout>>();
  const happyTimer = useRef<ReturnType<typeof setTimeout>>();
  const [arrived, setArrived] = useState(!arrive);
  const [eyeState, setEyeState] = useState<PawnEyeState>("normal");

  useEffect(() => {
    if (!arrive) return;
    const raf = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(raf);
  }, [arrive]);

  const happy = (ms: number) => {
    setEyeState("happy");
    clearTimeout(happyTimer.current);
    happyTimer.current = setTimeout(() => setEyeState((s) => (s === "happy" ? "normal" : s)), ms);
  };

  // Squish lebt auf einem eigenen inneren Element (pf-squishwrap), nie auf dem
  // äußeren pf-pawn (das trägt pf-in/arrive+bob) — sonst überschreibt die kurze
  // Squish-Animation die "animation"-Eigenschaft des Pawns komplett und der
  // Endzustand von arrive (opacity:1, forwards) geht verloren (Figur verschwindet).
  const squish = () => {
    const el = squishRef.current;
    if (!el) return;
    el.classList.remove("pf-squish");
    void el.offsetWidth;
    el.classList.add("pf-squish");
  };

  const celebrate = () => {
    const stage = stageRef.current;
    const target = squishRef.current;
    if (!stage || !target) return;
    stage.classList.remove("pf-celebrate");
    void stage.offsetWidth;
    stage.classList.add("pf-celebrate");
    target.classList.remove("pf-jump");
    void target.offsetWidth;
    target.classList.add("pf-jump");
    happy(1400);
  };

  useImperativeHandle(ref, () => ({ celebrate, squish }));

  useEffect(() => {
    if (!interactive) return;
    const pawn = pawnRef.current;
    if (!pawn) return;

    const wake = () => {
      pawn.classList.remove("pf-sleepmode");
      setEyeState((s) => (s === "sleep" ? "normal" : s));
      clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => {
        pawn.classList.add("pf-sleepmode");
        setEyeState("sleep");
      }, 11000);
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = pawn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.28;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 260));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 260));
      if (eyesRef.current) eyesRef.current.style.transform = `translate(${dx * 2.2}px,${dy * 1.8}px)`;
      wake();
    };
    const onScroll = () => wake();

    wake();
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(sleepTimer.current);
      clearTimeout(happyTimer.current);
    };
  }, [interactive]);

  const poke = () => {
    squish();
    const line = PAWN_SQUISH_LINES[Math.floor(Math.random() * PAWN_SQUISH_LINES.length)];
    happy(900);
    onTap?.(line);
  };

  const style = { "--pf-size": `${size}px` } as React.CSSProperties;

  return (
    <div className="pf-stage" ref={stageRef} style={style}>
      <span className="pf-spark pf-s1" aria-hidden="true" />
      <span className="pf-spark pf-s2" aria-hidden="true" />
      <span className="pf-spark pf-s3" aria-hidden="true" />
      <div
        ref={pawnRef}
        className={[
          "pf-pawn",
          arrived ? (arrive ? "pf-in" : "pf-in-static") : "",
          eyeState === "sleep" ? "pf-sleeping" : "",
          interactive ? "" : "pf-static",
          className ?? "",
        ].filter(Boolean).join(" ")}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? ariaLabel : undefined}
        onClick={interactive ? poke : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  poke();
                }
              }
            : undefined
        }
      >
        <div ref={squishRef} className="pf-squishwrap">
          <svg viewBox="0 0 100 132">
            <PawnBody rank={rank} fill={bodyFill} />
            <PawnEyes eyeState={eyeState === "happy" ? "happy" : "normal"} fill={eyeFill} eyewrapRef={eyesRef} />
          </svg>
          <span className="pf-zzz">z&nbsp;Z</span>
        </div>
      </div>
      {showShadow && <div className={["pf-shadow", arrived ? "pf-in" : ""].join(" ")} ref={shadowRef} />}
    </div>
  );
});

export interface PawnFigurStateProps {
  pose: "load" | "shrug" | "win";
  size?: number;
  className?: string;
}

/** Zustands-Maskottchen: Laden / Leer / Erfolg — ersetzt Spinner & generische Leerzustände. */
export function PawnFigurState({ pose, size = 42, className }: PawnFigurStateProps) {
  const eyeState: PawnEyeState = pose === "win" ? "happy" : pose === "shrug" ? "shrug" : "normal";
  const loopClass = pose === "load" ? "pf-loadloop" : pose === "win" ? "pf-winloop" : "pf-shrug";
  return (
    <div className={["pf-pawn", "pf-in-static", loopClass, className ?? ""].filter(Boolean).join(" ")} style={{ width: size, height: size * (132 / 100) }}>
      <PawnFigurSvg eyeState={eyeState} />
    </div>
  );
}
