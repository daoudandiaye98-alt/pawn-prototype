import logoAsset from "@/assets/pawn-logo.png.asset.json";
import { cn } from "@/lib/utils";

/** Official PAWN wordmark (P[pawn]WN). Use wherever the brand logo appears. */
export function Logo({
  className,
  invert = false,
  alt = "PAWN",
}: {
  className?: string;
  invert?: boolean;
  alt?: string;
}) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      draggable={false}
      className={cn(
        "block h-6 w-auto select-none object-contain",
        invert && "invert",
        className,
      )}
    />
  );
}
