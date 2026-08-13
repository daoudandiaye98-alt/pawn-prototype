import type { ImgHTMLAttributes } from "react";
import { useMediaUrl } from "@/lib/media";

/**
 * Drop-in-Ersatz für <img> bei Werkbildern: löst gespeicherte
 * designer-media-Orte beim Anzeigen in eine frische, kurzlebige URL auf.
 * Alle anderen Quellen (externe Bilder, data:, blob:) laufen unverändert durch.
 */
export function MediaImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const aufgeloest = useMediaUrl(typeof src === "string" ? src : null);
  return <img {...rest} src={aufgeloest} />;
}
