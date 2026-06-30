import { SVGProps } from "react";

/** Minimal architectural pawn chess piece — PAWN brand mark. */
export function PawnMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="16" cy="8" r="5" />
      <path d="M10 13 Q16 17 22 13" />
      <path d="M11 17 L21 17" />
      <path d="M13 17 C12 24 10 30 9 34 L23 34 C22 30 20 24 19 17" />
      <path d="M6 34 L26 34" />
      <path d="M5 38 L27 38" />
    </svg>
  );
}
