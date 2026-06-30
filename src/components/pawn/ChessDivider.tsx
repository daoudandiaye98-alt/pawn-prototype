import { PawnMark } from "./PawnMark";
import { cn } from "@/lib/utils";

/** Pawn glyph centered on a continuous hairline.
 *  Use as a structural section divider that visually links one section to the next. */
export function ChessDivider({
  className,
  invert = false,
  label,
}: {
  className?: string;
  invert?: boolean;
  label?: string;
}) {
  const line = invert ? "bg-primary-foreground/20" : "bg-foreground/15";
  const text = invert ? "text-primary-foreground/60" : "text-foreground/55";
  return (
    <div className={cn("editorial-container flex items-center gap-6 py-10", className)}>
      <span className={cn("h-px flex-1", line)} />
      <div className={cn("flex items-center gap-3", text)}>
        <PawnMark className="h-5 w-5" />
        {label && (
          <span className="text-[0.6rem] uppercase tracking-[0.32em]">{label}</span>
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
