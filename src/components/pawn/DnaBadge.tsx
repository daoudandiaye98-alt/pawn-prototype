/**
 * DnaBadge — the shared visual signature of PAWN's DNA layer.
 *
 * Same component on Product Cards, Product Detail, Designer pages, Cart summary.
 * The score and rationale come from `dnaMatchFor*` selectors so every surface
 * tells the same story.
 */
import { cn } from "@/lib/utils";
import type { DnaMatch } from "@/core/selectors/dna";

interface Props {
  match: DnaMatch;
  size?: "sm" | "md" | "lg";
  variant?: "ivory" | "ink";
  className?: string;
  showLabel?: boolean;
}

export function DnaBadge({ match, size = "sm", variant = "ivory", className, showLabel = false }: Props) {
  if (!match || match.percent === 0) return null;
  const dim = size === "lg" ? 68 : size === "md" ? 52 : 40;
  const stroke = size === "lg" ? 3 : 2;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (match.percent / 100);
  const isInk = variant === "ink";
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      title={`${match.percent}% DNA Match — ${match.rationale}`}
      aria-label={`DNA Match ${match.percent}%`}
    >
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="block">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={isInk ? "rgba(244,239,230,0.18)" : "rgba(20,13,13,0.15)"}
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={isInk ? "hsl(36 30% 90%)" : "hsl(0 55% 22%)"}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={c / 4}
            strokeLinecap="butt"
            transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "pawn-numeral tabular-nums",
              size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-[0.7rem]",
              isInk ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {match.percent}
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="flex flex-col leading-tight">
          <span className={cn("text-[0.55rem] uppercase tracking-[0.28em]", isInk ? "text-primary-foreground/60" : "text-muted-foreground")}>
            DNA Match
          </span>
          <span className={cn("text-[0.7rem]", isInk ? "text-primary-foreground/85" : "text-foreground/80")}>
            {match.topAxes.map((a) => a.label).join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
