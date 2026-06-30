import { ReactNode } from "react";

interface PageLabelProps {
  index?: string;
  children: ReactNode;
  className?: string;
}

/** Editorial numbered label e.g. "01 — Light". */
export function PageLabel({ index, children, className = "" }: PageLabelProps) {
  return (
    <span
      className={`inline-flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.32em] ${className}`}
    >
      {index && <span className="pawn-numeral text-[0.85rem]">{index}</span>}
      {index && <span className="h-px w-6 bg-current opacity-40" />}
      <span>{children}</span>
    </span>
  );
}

export function ThinDivider({
  vertical = false,
  className = "",
}: {
  vertical?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block bg-foreground/15 ${vertical ? "w-px h-full" : "h-px w-full"} ${className}`}
    />
  );
}
