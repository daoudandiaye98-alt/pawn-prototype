import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  seed: string;
  className?: string;
  label?: string;
  children?: ReactNode;
}

/**
 * Editorial fashion stand-in: warm ivory/oxblood palette,
 * abstract silhouette + thin architectural line.
 */
export function ProductImage({ seed, className, label, children }: ProductImageProps) {
  const hash = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variant = hash % 6;

  // Strict PAWN palette — ivory, beige, charcoal, oxblood
  const palettes: Array<[string, string, string]> = [
    ["#EFE7DC", "#1A1111", "#3A0D0D"], // ivory → black, wine accent
    ["#E8DED0", "#140D0D", "#2A1818"], // beige → near black
    ["#F4EFE6", "#1D1A18", "#4A1212"], // ivory deep → wine
    ["#D9CDB9", "#120B0B", "#2E1414"], // sand → ink
    ["#E2D6C2", "#1A1111", "#3A0D0D"], // warm clay
    ["#EFE7DC", "#0F0808", "#3A0D0D"],
  ];
  const [bg, ink, accent] = palettes[variant];

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(165deg, ${bg} 0%, ${ink} 165%)` }}
      aria-hidden
    >
      <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        {variant % 3 === 0 ? (
          // long coat silhouette
          <g fill={ink} opacity={0.92}>
            <path d="M72 38 L128 38 L150 96 L156 250 L44 250 L50 96 Z" />
            <path d="M50 96 L22 210 L42 220 L64 124 Z" />
            <path d="M150 96 L178 210 L158 220 L136 124 Z" />
            <line x1="100" y1="42" x2="100" y2="248" stroke={bg} strokeWidth="0.4" opacity="0.45" />
          </g>
        ) : variant % 3 === 1 ? (
          // tailored two-piece
          <g fill={ink} opacity={0.88}>
            <rect x="62" y="40" width="76" height="118" />
            <path d="M62 158 L72 250 L96 250 L100 158 Z" />
            <path d="M138 158 L128 250 L104 250 L100 158 Z" />
            <rect x="42" y="58" width="20" height="120" fill={accent} opacity={0.65} />
          </g>
        ) : (
          // draped dress
          <g fill={ink} opacity={0.9}>
            <path d="M80 36 Q100 22 120 36 L130 92 Q150 180 160 254 L40 254 Q50 180 70 92 Z" />
            <path d="M100 36 L100 254" stroke={bg} strokeWidth="0.4" opacity="0.4" fill="none" />
          </g>
        )}
        {/* architectural line */}
        <line
          x1="0"
          y1={120 + variant * 8}
          x2="200"
          y2={100 + variant * 8}
          stroke={accent}
          strokeWidth="0.4"
          opacity="0.7"
        />
        {/* corner crop ticks */}
        <g stroke={bg} strokeWidth="0.5" opacity="0.5">
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="8" x2="8" y2="16" />
          <line x1="192" y1="272" x2="184" y2="272" />
          <line x1="192" y1="272" x2="192" y2="264" />
        </g>
      </svg>
      {/* hover oxblood wash */}
      <div className="pointer-events-none absolute inset-0 bg-accent/0 transition-colors duration-500 group-hover:bg-accent/20" />
      {label && (
        <span className="absolute bottom-3 left-3 text-[0.6rem] uppercase tracking-[0.3em] text-background/80">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
