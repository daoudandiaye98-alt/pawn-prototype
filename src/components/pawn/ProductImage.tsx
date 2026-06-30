import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  seed: string;
  className?: string;
  label?: string;
  children?: ReactNode;
}

/**
 * Abstract, editorial visual stand-in for product photography.
 * Deterministic gradient + silhouette generated from a seed string.
 */
export function ProductImage({ seed, className, label, children }: ProductImageProps) {
  const hash = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variant = hash % 6;

  const palettes: Array<[string, string, string]> = [
    ["hsl(36 28% 84%)", "hsl(30 8% 18%)", "hsl(350 50% 22%)"],
    ["hsl(34 22% 78%)", "hsl(30 10% 12%)", "hsl(30 12% 30%)"],
    ["hsl(38 30% 90%)", "hsl(30 8% 22%)", "hsl(20 30% 40%)"],
    ["hsl(36 16% 70%)", "hsl(30 6% 14%)", "hsl(350 30% 35%)"],
    ["hsl(38 24% 86%)", "hsl(30 8% 10%)", "hsl(34 20% 50%)"],
    ["hsl(30 10% 70%)", "hsl(30 6% 8%)", "hsl(350 50% 22%)"],
  ];
  const [bg, ink, accent] = palettes[variant];

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(160deg, ${bg} 0%, ${ink} 140%)` }}
      aria-hidden
    >
      <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        {variant % 2 === 0 ? (
          <g fill={ink} opacity={0.85}>
            <path d="M70 40 L130 40 L150 100 L150 240 L50 240 L50 100 Z" />
            <path d="M50 100 L20 200 L40 210 L60 130 Z" />
            <path d="M150 100 L180 200 L160 210 L140 130 Z" />
          </g>
        ) : (
          <g fill={ink} opacity={0.8}>
            <rect x="60" y="40" width="80" height="200" />
            <rect x="40" y="60" width="20" height="160" fill={accent} opacity={0.7} />
            <rect x="140" y="60" width="20" height="160" />
          </g>
        )}
        <line x1="0" y1={120 + variant * 8} x2="200" y2={100 + variant * 8} stroke={accent} strokeWidth="0.5" opacity="0.6" />
      </svg>
      {label && (
        <span className="absolute bottom-3 left-3 text-[0.6rem] uppercase tracking-[0.3em] text-background/80">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
