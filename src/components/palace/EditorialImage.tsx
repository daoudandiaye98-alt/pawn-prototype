import { useState } from "react";

interface Props {
  src?: string | null;
  seed: string;
  ratio?: "3/4" | "4/5" | "3/2" | "1/1" | "16/9" | "5/4";
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

const RATIO_TO_DIM: Record<string, [number, number]> = {
  "3/4": [900, 1200],
  "4/5": [800, 1000],
  "3/2": [1200, 800],
  "1/1": [1000, 1000],
  "16/9": [1600, 900],
  "5/4": [1000, 800],
};

/**
 * EditorialImage — grayscale, hairline, calm hover-scale.
 * Falls back to a stable picsum seed when no DB image exists.
 */
export function EditorialImage({ src, seed, ratio = "3/4", className = "", alt = "", width, height, priority }: Props) {
  const [dim] = useState(() => RATIO_TO_DIM[ratio] ?? [1000, 1200]);
  const w = width ?? dim[0];
  const h = height ?? dim[1];
  const url = src && src.length > 0 ? src : `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
  return (
    <div
      className={`palace-image relative overflow-hidden bg-[#e8e5de] ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      <img
        src={url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className="palace-image-inner absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
