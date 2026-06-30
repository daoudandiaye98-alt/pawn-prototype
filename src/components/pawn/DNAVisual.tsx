import { SVGProps } from "react";

/** Abstract DNA helix / identity glyph used across PAWN. */
export function DNAVisual({ className, ...props }: SVGProps<SVGSVGElement>) {
  const rows = 18;
  return (
    <svg
      viewBox="0 0 200 320"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="dna-fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <g stroke="url(#dna-fade)" fill="none" strokeWidth="0.8">
        {Array.from({ length: rows }).map((_, i) => {
          const y = (i / (rows - 1)) * 300 + 10;
          const phase = (i / (rows - 1)) * Math.PI * 3;
          const x1 = 100 + Math.sin(phase) * 60;
          const x2 = 100 - Math.sin(phase) * 60;
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2} y2={y} />
              <circle cx={x1} cy={y} r="1.6" fill="currentColor" />
              <circle cx={x2} cy={y} r="1.6" fill="currentColor" />
            </g>
          );
        })}
        {/* helix curves */}
        <path
          d={`M ${100 + Math.sin(0) * 60} 10 ${Array.from({ length: 60 })
            .map((_, i) => {
              const t = i / 59;
              const y = t * 300 + 10;
              const x = 100 + Math.sin(t * Math.PI * 3) * 60;
              return `L ${x} ${y}`;
            })
            .join(" ")}`}
        />
        <path
          d={`M ${100 - Math.sin(0) * 60} 10 ${Array.from({ length: 60 })
            .map((_, i) => {
              const t = i / 59;
              const y = t * 300 + 10;
              const x = 100 - Math.sin(t * Math.PI * 3) * 60;
              return `L ${x} ${y}`;
            })
            .join(" ")}`}
        />
      </g>
    </svg>
  );
}

/** Thin radial DNA score badge. */
export function DNARing({
  score = 87,
  className,
}: {
  score?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 78;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g stroke="currentColor" fill="none">
        {[30, 45, 60, 75].map((rr) => (
          <circle key={rr} cx="100" cy="100" r={rr} strokeOpacity="0.15" />
        ))}
        <circle cx="100" cy="100" r={r} strokeOpacity="0.18" strokeWidth="1" />
        <circle
          cx="100"
          cy="100"
          r={r}
          strokeWidth="1.4"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 100 100)"
        />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 82}
              y1={100 + Math.sin(a) * 82}
              x2={100 + Math.cos(a) * 90}
              y2={100 + Math.sin(a) * 90}
              strokeOpacity="0.4"
            />
          );
        })}
      </g>
      <text
        x="100"
        y="108"
        textAnchor="middle"
        fontFamily="Playfair Display, serif"
        fontSize="56"
        fill="currentColor"
      >
        {score}
      </text>
      <text
        x="100"
        y="130"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="7"
        letterSpacing="3"
        fill="currentColor"
        opacity="0.6"
      >
        DNA SCORE
      </text>
    </svg>
  );
}
