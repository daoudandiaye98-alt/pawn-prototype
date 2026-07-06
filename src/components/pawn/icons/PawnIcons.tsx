import { SVGProps } from "react";

/**
 * PAWN icon family — inline SVGs on a 20px grid, stroke 1.25.
 * Reduced silhouettes in the PAWN chess vocabulary.
 * All icons accept standard SVG props (className, aria-hidden, ...).
 */

const BASE: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Warenkorb — Pawn silhouette on a square base. Shows filled count badge when count > 0. */
export function PawnBagIcon({ count, ...props }: SVGProps<SVGSVGElement> & { count?: number }) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Base plinth */}
      <rect x="3" y="15" width="14" height="2.4" />
      {/* Pawn body (rising from base) */}
      <path d="M6.5 15 C6.5 12.4 7.3 10.6 8.2 9.3" />
      <path d="M13.5 15 C13.5 12.4 12.7 10.6 11.8 9.3" />
      <path d="M7.4 9.3 L12.6 9.3" />
      {/* Neck & head */}
      <path d="M8.4 9.3 C8.4 7.9 8.9 7 10 7 C11.1 7 11.6 7.9 11.6 9.3" />
      <circle cx="10" cy="4.6" r="1.9" />
      {/* Count badge (filled, on the base) */}
      {typeof count === "number" && count > 0 && (
        <g>
          <rect x="12.4" y="15.3" width="4.6" height="2.1" fill="currentColor" stroke="none" />
          <text
            x="14.7"
            y="17"
            textAnchor="middle"
            fontSize="1.9"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="600"
            fill="hsl(var(--background))"
            stroke="none"
          >
            {count > 9 ? "9+" : count}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Profil — Königs-/Damen-Silhouette als Kopf mit kleiner Krone. */
export function PawnProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Crown notch */}
      <path d="M8 3.4 L10 2 L12 3.4" />
      {/* Head silhouette */}
      <path d="M6.5 8.6 C6.5 6.4 8 5 10 5 C12 5 13.5 6.4 13.5 8.6" />
      <path d="M6.6 8.6 C6.6 10.4 8.1 11.6 10 11.6 C11.9 11.6 13.4 10.4 13.4 8.6" />
      {/* Shoulder line */}
      <path d="M4.5 17 C4.5 13.9 6.9 12.5 10 12.5 C13.1 12.5 15.5 13.9 15.5 17" />
    </svg>
  );
}

/** Suche — Linse in derselben Linienfamilie. */
export function PawnSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <circle cx="9" cy="9" r="4.6" />
      <path d="M12.6 12.6 L16 16" />
    </svg>
  );
}

/** Menü — drei Linien, gleiche Familie. */
export function PawnMenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M3.5 6 H16.5" />
      <path d="M3.5 10 H16.5" />
      <path d="M3.5 14 H16.5" />
    </svg>
  );
}

/** Schließen — X in derselben Linienfamilie. */
export function PawnCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M4.5 4.5 L15.5 15.5" />
      <path d="M15.5 4.5 L4.5 15.5" />
    </svg>
  );
}
