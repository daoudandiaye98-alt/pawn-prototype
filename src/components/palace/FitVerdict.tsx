/**
 * „Deine Passform" — das Urteil direkt an der Größenwahl. Reine Rechnung aus den
 * hinterlegten Körpermaßen und der Maßtabelle des Hauses, kein KI-Aufruf.
 */
import { Link } from "react-router-dom";
import { useMyMeasurements } from "@/features/fit/useMyMeasurements";
import { computeFit, hasAnyBodyValue } from "@/features/fit/measurements";
import type { Measurements } from "@/features/studio/productDetails";

interface Props {
  measurements: Measurements | null;
  sizes: string[];
  /** Wird aufgerufen, wenn die vorgeschlagene Größe übernommen werden soll. */
  onPick?: (size: string) => void;
}

export function FitVerdict({ measurements, sizes, onPick }: Props) {
  const { body, loading, signedIn } = useMyMeasurements();

  if (!signedIn || loading) return null;
  if (!measurements || measurements.rows.length === 0 || sizes.length === 0) return null;

  if (!hasAnyBodyValue(body)) {
    return (
      <div className="house-hair house-ink mt-6 border-t pt-4">
        <p className="palace-eyebrow">Deine Passform</p>
        <p className="mt-2 text-[0.9rem] opacity-70">
          Hinterlege einmal deine Maße — dann sagen wir dir sofort, welche Größe passt.{" "}
          <Link to="/dna#massband" className="underline underline-offset-4">Maße eintragen →</Link>
        </p>
      </div>
    );
  }

  const fit = computeFit(body, measurements, sizes);
  if (!fit.possible) return null;

  return (
    <div className="house-hair house-ink mt-6 border-t pt-4">
      <p className="palace-eyebrow">Deine Passform</p>
      <ul className="mt-2 space-y-1">
        {fit.sizes.map((s) => (
          <li key={s.size} className="text-[0.9rem]">
            <button
              type="button"
              onClick={() => onPick?.(s.size)}
              className="text-left underline-offset-4 hover:underline"
            >
              <span className="font-medium">{s.size}</span>{" "}
              <span className="opacity-70">
                — {s.level === "passt" ? "passt" : s.level === "knapp" ? "zu knapp" : s.level === "weit" ? "sehr weit" : "unklar"} ({s.reason})
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.75rem] opacity-55">
        Berechnet aus deinen Maßen und der Maßtabelle dieses Hauses.{" "}
        <Link to="/dna#massband" className="underline underline-offset-4">Maße ändern</Link>
      </p>
    </div>
  );
}
