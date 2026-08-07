import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <Button asChild variant="editorial" className="h-9 w-9 justify-center bg-white p-0 text-black hover:bg-black hover:text-white">
          <Link to={prev.to} aria-label={prev.label ?? "Vorheriges"} title={prev.label ?? "Vorheriges"}>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.4} />
          </Link>
        </Button>
      ) : (
        <span className="h-9 w-9 opacity-0" aria-hidden />
      )}
      {next ? (
        <Button asChild variant="editorial" className="h-9 w-9 justify-center bg-white p-0 text-black hover:bg-black hover:text-white">
          <Link to={next.to} aria-label={next.label ?? "Nächstes"} title={next.label ?? "Nächstes"}>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.4} />
          </Link>
        </Button>
      ) : (
        <span className="h-9 w-9 opacity-0" aria-hidden />
      )}
    </div>
  );
}
