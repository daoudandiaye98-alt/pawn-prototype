import { PawnMark } from "./PawnMark";
import { cn } from "@/lib/utils";

/**
 * Pawn glyph zentriert auf einer Hairline — jetzt zusätzlich mit optionaler
 * Rang-Anzeige: acht schmale Marker, der aktuelle hervorgehoben. So wird jede
 * Section-Grenze zum sichtbaren Fortschritt auf dem Brett.
 */
export function ChessDivider({
  className,
  invert = false,
  label,
  rank,
}: {
  className?: string;
  invert?: boolean;
  label?: string;
  /** 0..8 — Rang des Bauern. Wenn gesetzt, ersetzen die Marker das Label. */
  rank?: number;
}) {
  const line = invert ? "bg-primary-foreground/20" : "bg-foreground/15";
  const text = invert ? "text-primary-foreground/60" : "text-foreground/55";
  const dot = invert ? "bg-primary-foreground/25" : "bg-foreground/25";
  const dotActive = invert ? "bg-primary-foreground" : "bg-foreground";
  return (
    <div className={cn("editorial-container flex items-center gap-6 py-10", className)}>
      <span className={cn("h-px flex-1", line)} />
      <div className={cn("flex items-center gap-3", text)}>
        <PawnMark className="h-5 w-5" />
        {typeof rank === "number" ? (
          <div className="flex items-center gap-1.5" aria-label={`Rang ${rank} von 8`}>
            {Array.from({ length: 8 }).map((_, i) => {
              const active = i < rank;
              const current = i === rank - 1;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-1 rounded-full transition-all duration-500",
                    active ? dotActive : dot,
                    current && "h-1.5 w-1.5",
                  )}
                />
              );
            })}
          </div>
        ) : (
          label && <span className="text-[0.6rem] uppercase tracking-[0.32em]">{label}</span>
        )}
      </div>
      <span className={cn("h-px flex-1", line)} />
    </div>
  );
}

/** Recurring "CHAPTER 0X — TITLE" rhythm label. */
export function ChapterLabel({
  index,
  children,
  className,
  invert = false,
}: {
  index: string;
  children: React.ReactNode;
  className?: string;
  invert?: boolean;
}) {
  const tone = invert ? "text-primary-foreground/65" : "text-foreground/65";
  return (
    <div className={cn("flex items-center gap-4", tone, className)}>
      <span className="pawn-numeral text-base">{index}</span>
      <span className={cn("h-px w-10", invert ? "bg-primary-foreground/30" : "bg-foreground/30")} />
      <span className="text-[0.6rem] uppercase tracking-[0.34em]">Chapter — {children}</span>
    </div>
  );
}
