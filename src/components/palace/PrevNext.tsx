import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Prev/Next navigation, top-right, Palace-Stil.
 * Positioning is the caller's responsibility — this is a pure control.
 */
export function PrevNext({
  prev,
  next,
  className = "",
}: {
  prev: { to: string; label?: string } | null;
  next: { to: string; label?: string } | null;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {prev ? (
        <Link
          to={prev.to}
          aria-label={prev.label ?? "Vorheriges"}
          title={prev.label ?? "Vorheriges"}
          className="palace-btn h-9 w-9 justify-center bg-[#F1EEE7] p-0 text-[#0C0C0E] hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.4} />
        </Link>
      ) : (
        <span className="h-9 w-9 opacity-0" aria-hidden />
      )}
      {next ? (
        <Link
          to={next.to}
          aria-label={next.label ?? "Nächstes"}
          title={next.label ?? "Nächstes"}
          className="palace-btn h-9 w-9 justify-center bg-[#F1EEE7] p-0 text-[#0C0C0E] hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
        >
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.4} />
        </Link>
      ) : (
        <span className="h-9 w-9 opacity-0" aria-hidden />
      )}
    </div>
  );
}
