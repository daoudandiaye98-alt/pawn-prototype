import { useEffect, useState } from "react";
import { PawnFigurSvg, type PawnEyeState } from "./PawnFigur";

/**
 * Das einzige PAWN-Element auf Kauf-/Kassenseiten: 46px, schwarzes Quadrat, weiße Figur,
 * nur Blinzeln. Kein Wippen, keine Materialisierung, keine Sprüche, keine Stimmungs-Bewegung —
 * auf diesen Seiten hat der Kauf Vorrang (Teil 35).
 */
export function PawnBlinkButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  const [eyeState, setEyeState] = useState<PawnEyeState>("normal");

  useEffect(() => {
    let cycle: ReturnType<typeof setTimeout>;
    let blink: ReturnType<typeof setTimeout>;
    const schedule = () => {
      cycle = setTimeout(() => {
        setEyeState("sleep");
        blink = setTimeout(() => {
          setEyeState("normal");
          schedule();
        }, 160);
      }, 3200 + Math.random() * 2800);
    };
    schedule();
    return () => { clearTimeout(cycle); clearTimeout(blink); };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-[46px] w-[46px] shrink-0 items-center justify-center border-[1.5px] border-black bg-black"
    >
      <PawnFigurSvg invert eyeState={eyeState} className="h-[21px] w-[16px]" />
    </button>
  );
}
