import { cn } from "@/lib/utils";
import { PawnWordmark } from "./PawnWordmark";

/** Legacy Logo shim → forwards to PawnWordmark for backwards compatibility. */
export function Logo({
  className,
  invert = false,
}: {
  className?: string;
  invert?: boolean;
  alt?: string;
}) {
  return (
    <PawnWordmark
      className={cn("text-[1.4rem]", invert ? "text-white" : "text-black", className)}
    />
  );
}
